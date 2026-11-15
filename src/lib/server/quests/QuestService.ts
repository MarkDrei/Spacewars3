// ---
// QuestService - applies the mission rules (src/shared/quests/questEngine.ts) to a player:
// loads state and cargo, runs the rules, stores the result and hands out the effects
// (cargo, commanders, XP, iron, notifications).
//
// Locking: USER_LOCK (player data, ship position) → released → USER_INVENTORY_LOCK (mission state
// + inventory) → released → USER_LOCK (XP, iron) → released → messages. The database is the
// source of truth for every change; the in-memory copy only serves the world poll.
// ---

import { LockContext, LocksAtMost3 } from '@markdrei/ironguard-typescript-locks';
import { calculateToroidalDistance } from '@shared/physics';
import { DEFAULT_WORLD_BOUNDS } from '@shared/worldConstants';
import { USER_INVENTORY_LOCK, USER_LOCK, WORLD_LOCK } from '../typedLocks';
import { UserCache } from '../user/userCache';
import { WorldCache } from '../world/worldCache';
import { getResearchEffectFromTree, ResearchType } from '../techs/techtree';
import { TimeMultiplierService } from '../timeMultiplier';
import { sendMessageToUser } from '../messages/MessageCache';
import { getServerT } from '../i18n/serverTranslations';
import { Commander } from '../inventory/Commander';
import { InventoryService } from '../inventory/InventoryService';
import { addCargoToGrid, addItemToGrid, getCargoHold, removeAllCargoFromGrid, removeCargoFromGrid } from '../inventory/cargo';
import type { InventoryGrid } from '../inventory/inventoryTypes';
import { QuestRepo } from './QuestRepo';
import { questNotificationText } from '@/shared/quests/questMessages';
import { CONTACTS, HAIL_RANGE, contactPosition, type ContactId } from '@/shared/quests/npcArchetypes';
import { getLocation, type LocationId } from '@/shared/quests/locations';
import { getQuest } from '@/shared/quests/questDefinitions';
import {
  abandonQuest,
  acceptQuest,
  applyQuestEvent,
  createInitialQuestState,
  debugFulfilStage,
  debugUnlockPrerequisites,
  getVisitCandidates,
  reportQuest,
  type QuestContext,
} from '@/shared/quests/questEngine';
import type {
  CargoStack,
  PlayerQuestState,
  QuestActionResult,
  QuestEffects,
  QuestEngineResult,
  QuestEvent,
  QuestNotification,
  QuestOverview,
} from '@/shared/quests/questTypes';

type Position = { x: number; y: number };

interface PlayerSnapshot {
  level: number;
  locale: string;
  maxInventorySlots: number;
  /** Position of the player's ship, when the action needs it. */
  position: Position | null;
}

/** Rule context of admin test tools: no level limits and every contact in range. */
const TEST_TOOL_LEVEL = 99;

declare global {
  var questServiceInstance: QuestService | undefined;
}

export class QuestService {
  /** Last known state per player, for lock-free reads in the world poll. */
  private readonly knownStates = new Map<number, PlayerQuestState>();

  constructor(
    private readonly repo: QuestRepo = new QuestRepo(),
    private readonly inventory: InventoryService = new InventoryService()
  ) {}

  static getInstance(): QuestService {
    if (!globalThis.questServiceInstance) {
      globalThis.questServiceInstance = new QuestService();
    }
    return globalThis.questServiceInstance;
  }

  static resetInstance(): void {
    globalThis.questServiceInstance = undefined;
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** Mission state of a player; read from the database on first access, then from memory. */
  async getState(context: LockContext<LocksAtMost3>, userId: number): Promise<PlayerQuestState> {
    const known = this.knownStates.get(userId);
    if (known) return known;
    return context.useLockWithAcquire(USER_INVENTORY_LOCK, async (inventoryContext) => {
      const state = (await this.repo.load(inventoryContext, userId)) ?? createInitialQuestState();
      this.knownStates.set(userId, state);
      return state;
    });
  }

  async getOverview(context: LockContext<LocksAtMost3>, userId: number): Promise<QuestOverview | null> {
    const player = await this.loadPlayer(context, userId, true);
    if (!player) return null;
    return context.useLockWithAcquire(USER_INVENTORY_LOCK, async (inventoryContext) => {
      const state = (await this.repo.load(inventoryContext, userId)) ?? createInitialQuestState();
      this.knownStates.set(userId, state);
      const grid = await this.inventory.loadGridWithLock(inventoryContext, userId, player.maxInventorySlots);
      return {
        state,
        level: player.level,
        cargo: getCargoHold(grid, player.maxInventorySlots),
        contactsInRange: contactsInRangeOf(player.position),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Player actions (throw QuestRuleError when the rules do not allow them)
  // ---------------------------------------------------------------------------

  async accept(context: LockContext<LocksAtMost3>, userId: number, questId: string): Promise<QuestActionResult> {
    return this.run(context, userId, true, (state, ctx) => acceptQuest(state, questId, ctx));
  }

  async report(
    context: LockContext<LocksAtMost3>,
    userId: number,
    questId: string,
    contactId: ContactId
  ): Promise<QuestActionResult> {
    return this.run(context, userId, true, (state, ctx) => reportQuest(state, questId, contactId, ctx));
  }

  async abandon(context: LockContext<LocksAtMost3>, userId: number, questId: string): Promise<QuestActionResult> {
    return this.run(context, userId, false, (state, ctx) => abandonQuest(state, questId, ctx));
  }

  // ---------------------------------------------------------------------------
  // Game events
  // ---------------------------------------------------------------------------

  /** Feeds a game event (object collected, battle won, …) into the player's missions. */
  async recordEvent(context: LockContext<LocksAtMost3>, userId: number, event: QuestEvent): Promise<QuestActionResult> {
    return this.run(context, userId, false, (state, ctx) => applyQuestEvent(state, event, ctx));
  }

  /**
   * Checks whether the ship is at a location that matters (undiscovered or asked for by a
   * mission) and records the visit. Cheap when nothing is in range: no lock, no database access
   * beyond the first load of the state.
   */
  async recordVisits(context: LockContext<LocksAtMost3>, userId: number, position: Position): Promise<void> {
    const state = await this.getState(context, userId);
    for (const locationId of locationsAt(position, getVisitCandidates(state))) {
      await this.recordEvent(context, userId, { type: 'location_visited', locationId });
    }
  }

  // ---------------------------------------------------------------------------
  // Test tools (admin routes only)
  // ---------------------------------------------------------------------------

  /** Deletes all mission progress, achievements and mission cargo of a player. */
  async resetProgress(context: LockContext<LocksAtMost3>, userId: number): Promise<void> {
    const player = await this.loadPlayer(context, userId, false);
    if (!player) return;
    await context.useLockWithAcquire(USER_INVENTORY_LOCK, async (inventoryContext) => {
      await this.repo.delete(inventoryContext, userId);
      this.knownStates.delete(userId);
      const grid = await this.inventory.loadGridWithLock(inventoryContext, userId, player.maxInventorySlots);
      removeAllCargoFromGrid(grid);
      await this.inventory.saveGridWithLock(inventoryContext, userId, grid);
    });
  }

  /** Accepts a quest regardless of level and distance, after completing its prerequisites. */
  async forceAccept(context: LockContext<LocksAtMost3>, userId: number, questId: string): Promise<QuestActionResult> {
    return this.run(
      context,
      userId,
      false,
      (state, ctx) => {
        const unlocked = debugUnlockPrerequisites(state, questId, ctx);
        const accepted = acceptQuest(unlocked.state, questId, applyCargoEffects(ctx, unlocked.effects));
        return mergeResults(unlocked, accepted);
      },
      true
    );
  }

  /** Fulfils the objectives of the current stage; a stage with a contact still has to be reported. */
  async fulfilStage(context: LockContext<LocksAtMost3>, userId: number, questId: string): Promise<QuestActionResult> {
    return this.run(context, userId, false, (state, ctx) => debugFulfilStage(state, questId, ctx), true);
  }

  /** Reports the current stage to its contact regardless of the distance. */
  async forceReport(context: LockContext<LocksAtMost3>, userId: number, questId: string): Promise<QuestActionResult> {
    return this.run(
      context,
      userId,
      false,
      (state, ctx) => {
        const fulfilled = debugFulfilStage(state, questId, ctx);
        const contactId = currentStageContact(fulfilled.state, questId);
        if (!contactId) return fulfilled;
        const reported = reportQuest(fulfilled.state, questId, contactId, applyCargoEffects(ctx, fulfilled.effects));
        return mergeResults(fulfilled, reported);
      },
      true
    );
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async run(
    context: LockContext<LocksAtMost3>,
    userId: number,
    needsPosition: boolean,
    apply: (state: PlayerQuestState, ctx: QuestContext) => QuestEngineResult,
    testTool = false
  ): Promise<QuestActionResult> {
    const player = await this.loadPlayer(context, userId, needsPosition);
    if (!player) return { notifications: [], revision: 0 };

    const outcome = await context.useLockWithAcquire(USER_INVENTORY_LOCK, async (inventoryContext) => {
      const state = (await this.repo.load(inventoryContext, userId)) ?? createInitialQuestState();
      const grid = await this.inventory.loadGridWithLock(inventoryContext, userId, player.maxInventorySlots);
      const result = apply(state, {
        now: Date.now(),
        level: testTool ? TEST_TOOL_LEVEL : player.level,
        cargo: getCargoHold(grid, player.maxInventorySlots),
        contactsInRange: testTool ? CONTACTS.map((contact) => contact.id) : contactsInRangeOf(player.position),
        rng: Math.random,
      });
      this.knownStates.set(userId, result.state);
      if (!result.changed) return { result, commanders: [] as Commander[] };

      await this.repo.save(inventoryContext, userId, result.state);
      const commanders = applyInventoryEffects(grid, player.maxInventorySlots, result.effects);
      if (commanders.length > 0 || result.effects.cargoAdd.length > 0 || result.effects.cargoRemove.length > 0) {
        await this.inventory.saveGridWithLock(inventoryContext, userId, grid);
      }
      return { result, commanders };
    });

    const { result, commanders } = outcome;
    const newLevel = await this.grantRewards(context, userId, result.effects);
    await this.notify(context, userId, player.locale, result.effects.notifications, commanders, newLevel);
    return { notifications: result.effects.notifications, revision: result.state.revision };
  }

  /** Reads what the rules need to know about the player. Null for unknown users. */
  private async loadPlayer(
    context: LockContext<LocksAtMost3>,
    userId: number,
    withPosition: boolean
  ): Promise<PlayerSnapshot | null> {
    return context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await UserCache.getInstance2().getUserByIdWithLock(userContext, userId);
      if (!user) return null;
      const snapshot: PlayerSnapshot = {
        level: user.getLevel(),
        locale: user.preferredLocale ?? 'en',
        maxInventorySlots: Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.InventorySlots)),
        position: null,
      };
      if (withPosition && user.ship_id !== undefined) {
        const shipId = user.ship_id;
        snapshot.position = await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
          const ship = WorldCache.getInstance().getWorldFromCache(worldContext).getSpaceObject(worldContext, shipId);
          return ship ? { x: ship.x, y: ship.y } : null;
        });
      }
      return snapshot;
    });
  }

  /** Adds XP and iron. Returns the new level when the XP caused a level-up. */
  private async grantRewards(
    context: LockContext<LocksAtMost3>,
    userId: number,
    effects: QuestEffects
  ): Promise<number | null> {
    if (effects.xp <= 0 && effects.iron <= 0) return null;
    return context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const userCache = UserCache.getInstance2();
      const user = await userCache.getUserByIdWithLock(userContext, userId);
      if (!user) return null;
      if (effects.iron > 0) {
        const bonuses = await userCache.getBonusesByUserIdWithLock(userContext, userId);
        user.addIron(effects.iron, bonuses.ironStorageCapacity);
      }
      const levelUp = effects.xp > 0 ? user.addXp(effects.xp) : undefined;
      await userCache.updateUserInCache(userContext, user);
      return levelUp?.leveledUp ? levelUp.newLevel : null;
    });
  }

  private async notify(
    context: LockContext<LocksAtMost3>,
    userId: number,
    locale: string,
    notifications: readonly QuestNotification[],
    commanders: readonly Commander[],
    newLevel: number | null
  ): Promise<void> {
    if (notifications.length === 0 && commanders.length === 0 && newLevel === null) return;
    try {
      const t = await getServerT(locale, 'quests');
      for (const notification of notifications) {
        await sendMessageToUser(context, userId, questNotificationText(t, notification));
      }
      for (const commander of commanders) {
        const bonuses = commander.statBonuses.map((bonus) => `${bonus.stat} +${bonus.value}%`).join(', ');
        await sendMessageToUser(context, userId, t('notifications.commanderJoined', { commander: commander.name, bonuses }));
      }
      if (newLevel !== null) {
        const tMessages = await getServerT(locale, 'messages');
        await sendMessageToUser(context, userId, tMessages('levelUp', { level: newLevel }));
      }
    } catch (error) {
      // The mission state is already stored; a lost notification must not fail the action
      console.error('❌ Failed to send mission notifications:', error);
    }
  }
}

/** Contact of the current stage of an active quest. */
function currentStageContact(state: PlayerQuestState, questId: string): ContactId | undefined {
  const progress = state.quests[questId];
  if (progress?.status !== 'active') return undefined;
  return getQuest(questId)?.stages[progress.stage]?.reportTo;
}

/** Contacts whose ship is within hail range of the position. */
function contactsInRangeOf(position: Position | null): ContactId[] {
  if (!position) return [];
  const nowMs = Date.now();
  const multiplier = TimeMultiplierService.getInstance().getMultiplier();
  return CONTACTS.filter(
    (contact) =>
      calculateToroidalDistance(position, contactPosition(contact, nowMs, multiplier), DEFAULT_WORLD_BOUNDS) <=
      HAIL_RANGE
  ).map((contact) => contact.id);
}

/** The candidates whose location the position is in. */
function locationsAt(position: Position, candidates: readonly LocationId[]): LocationId[] {
  return candidates.filter((locationId) => {
    const location = getLocation(locationId);
    return calculateToroidalDistance(position, location, DEFAULT_WORLD_BOUNDS) <= location.radius;
  });
}

/** Applies cargo changes and commander rewards to the grid. Returns the commanders that joined. */
function applyInventoryEffects(grid: InventoryGrid, maxSlots: number, effects: QuestEffects): Commander[] {
  for (const stack of effects.cargoRemove) {
    removeCargoFromGrid(grid, maxSlots, stack.cargoId, stack.quantity);
  }
  for (const stack of effects.cargoAdd) {
    // The rules have checked the free slots against the same grid
    addCargoToGrid(grid, maxSlots, stack.cargoId, stack.quantity);
  }
  const commanders: Commander[] = [];
  for (let i = 0; i < effects.commanders; i++) {
    const commander = Commander.random();
    if (addItemToGrid(grid, maxSlots, commander.toJSON())) commanders.push(commander);
  }
  return commanders;
}

/** Rule context for a second rule call: the cargo hold after the effects of the first one. */
function applyCargoEffects(ctx: QuestContext, effects: QuestEffects): QuestContext {
  const counts = { ...ctx.cargo.counts };
  let freeSlots = ctx.cargo.freeSlots;
  for (const stack of effects.cargoRemove) {
    const remaining = (counts[stack.cargoId] ?? 0) - stack.quantity;
    if (remaining > 0) {
      counts[stack.cargoId] = remaining;
    } else if (stack.cargoId in counts) {
      delete counts[stack.cargoId];
      freeSlots += 1;
    }
  }
  for (const stack of effects.cargoAdd) {
    if (!(stack.cargoId in counts)) freeSlots -= 1;
    counts[stack.cargoId] = (counts[stack.cargoId] ?? 0) + stack.quantity;
  }
  return { ...ctx, cargo: { counts, freeSlots } };
}

/**
 * Result of two rule calls in a row. Cargo is netted per type (added in the first call and
 * handed over in the second = no change), so the order of applying removals and additions
 * does not matter.
 */
function mergeResults(first: QuestEngineResult, second: QuestEngineResult): QuestEngineResult {
  const net = new Map<string, number>();
  const count = (stacks: readonly CargoStack[], sign: number): void => {
    for (const stack of stacks) net.set(stack.cargoId, (net.get(stack.cargoId) ?? 0) + sign * stack.quantity);
  };
  count(first.effects.cargoAdd, 1);
  count(first.effects.cargoRemove, -1);
  count(second.effects.cargoAdd, 1);
  count(second.effects.cargoRemove, -1);
  const stacks = [...net].map(([cargoId, quantity]) => ({ cargoId, quantity }));

  return {
    state: second.state,
    changed: first.changed || second.changed,
    effects: {
      xp: first.effects.xp + second.effects.xp,
      iron: first.effects.iron + second.effects.iron,
      commanders: first.effects.commanders + second.effects.commanders,
      cargoAdd: stacks.filter((stack) => stack.quantity > 0),
      cargoRemove: stacks.filter((stack) => stack.quantity < 0).map((stack) => ({ ...stack, quantity: -stack.quantity })),
      notifications: [...first.effects.notifications, ...second.effects.notifications],
    },
  };
}
