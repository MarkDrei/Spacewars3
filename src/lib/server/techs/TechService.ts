import { LockContext, LocksAtMostAndHas4, createLockContext } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '../user/userCache';
import { User } from '../user/user';
import { TechFactory, TechCounts, BuildQueueItem } from './TechFactory';
import { DefenseValues } from '@/shared/defenseValues';
import { MessageCache } from '../messages/MessageCache';
import { TechTree, ResearchType, getResearchEffectFromTree } from './techtree';
import { TimeMultiplierService } from '../timeMultiplier';
import { UserBonusCache } from '../bonus/UserBonusCache';
import { getServerT } from '../i18n/serverTranslations';

export class TechService {
    private static instance: TechService | null = null;
    // Test overrides only. Production code resolves the cache singletons on every access, so a
    // reset/re-initialised cache is never shadowed by a stale reference.
    private userCacheOverride: UserCache | null = null;
    private messageCacheOverride: MessageCache | null = null;

    private constructor() {}

    public static getInstance(): TechService {
        if (!TechService.instance) {
            TechService.instance = new TechService();
        }
        return TechService.instance;
    }

    /** Drop the singleton (and any test overrides). For tests. */
    public static resetInstance(): void {
        TechService.instance = null;
    }

    /**
     * Set user cache instance for testing (null restores the default singleton lookup)
     */
    public setUserCacheForTesting(cache: UserCache | null): void {
        this.userCacheOverride = cache;
    }

    /**
     * Set message cache instance for testing (null restores the default singleton lookup)
     */
    public setMessageCacheForTesting(cache: MessageCache | null): void {
        this.messageCacheOverride = cache;
    }

    private getUserCache(): UserCache {
        return this.userCacheOverride ?? UserCache.getInstance2();
    }

    private getMessageCache(): MessageCache {
        return this.messageCacheOverride ?? MessageCache.getInstance();
    }

    /**
     * Get the tech counts for a user
     */
    async getTechCounts(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<TechCounts | null> {
        const user = await this.getUserCache().getUserByIdWithLock(context, userId);

        if (!user) return null;

        return user.techCounts;
    }

    /**
     * Get the current iron amount for a user
     */
    async getIron(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<number | null> {
        const user = await this.getUserCache().getUserByIdWithLock(context, userId);

        if (!user) return null;

        return user.iron;
    }

    /**
     * Get the build queue for a user with calculated completion times
     */
    async getBuildQueue(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<BuildQueueItem[] | null> {
        const user = await this.getUserCache().getUserByIdWithLock(context, userId);

        if (!user) return null;

        const bonuses = await UserBonusCache.getInstance().getBonuses(context, userId);
        return this.calculateQueueCompletionTimes(user, bonuses.constructionSpeedFactor);
    }

    /**
     * Get estimated completion time for the current build
     */
    async getEstimatedCompletionTime(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<number | null> {
        const status = await this.getBuildStatus(userId, context);
        return status?.queueEstimatedCompletion ?? null;
    }

    /**
     * Everything the factory page polls, computed from a single user refresh.
     * The refresh (updateStats) accrues iron and processes due builds chronologically,
     * so the follow-up item of a finished build is paid with the iron available at that time.
     */
    async getBuildStatus(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<{
        techCounts: TechCounts;
        buildQueue: BuildQueueItem[];
        queueEstimatedCompletion: number | null;
        analysis: ReturnType<typeof TechFactory.calculateTotalEffects>;
    } | null> {
        const user = await this.getUserCache().getUserByIdWithLock(context, userId);

        if (!user) return null;

        const bonuses = await UserBonusCache.getInstance().getBonuses(context, userId);
        const buildQueue = this.calculateQueueCompletionTimes(user, bonuses.constructionSpeedFactor);

        return {
            techCounts: user.techCounts,
            buildQueue,
            queueEstimatedCompletion: user.buildStartSec ? buildQueue[0]?.completionTime || null : null,
            analysis: TechFactory.calculateTotalEffects(user.techCounts),
        };
    }

    /** Returns the queue with cumulative completion times (0 when the queue has no start time). */
    private calculateQueueCompletionTimes(user: User, constructionSpeedFactor: number): BuildQueueItem[] {
        const queue = user.buildQueue;
        if (queue.length === 0 || !user.buildStartSec) {
            return queue;
        }

        const multiplier = TimeMultiplierService.getInstance().getMultiplier();
        let cumulativeTime = user.buildStartSec;

        return queue.map(item => {
            const spec = TechFactory.getTechSpec(item.itemKey, item.itemType);
            if (!spec) {
                return { ...item, completionTime: 0 };
            }

            const effectiveBuildTime = spec.buildDurationMinutes * 60 / multiplier / constructionSpeedFactor;
            cumulativeTime += effectiveBuildTime; // Next item starts after this one
            return { ...item, completionTime: cumulativeTime };
        });
    }

    /**
     * Add an item to the build queue.
     * Iron is only deducted for the first item (which starts building immediately).
     * Subsequent items are queued without charging iron; they are charged by
     * processCompletedBuilds when they actually start.
     */
    async addTechItemToBuildQueue(
        userId: number,
        itemKey: string,
        itemType: 'weapon' | 'defense',
        context: LockContext<LocksAtMostAndHas4>,
        options: { isRecurring?: boolean } = {}
    ): Promise<{ success: boolean; error?: string }> {
        const user = await this.getUserCache().getUserByIdWithLock(context, userId);

        if (!user) return { success: false, error: 'User not found' };

        // Check if item exists
        const spec = TechFactory.getTechSpec(itemKey, itemType);
        if (!spec) return { success: false, error: 'Invalid tech item' };

        const removedRecurringItem = this.removeRecurringQueueItem(user);

        // Only charge iron for the first item in the queue (it starts building immediately).
        // Subsequent items are free to queue; iron is charged when each build starts.
        const isFirstItem = user.buildQueue.length === 0;
        if (isFirstItem) {
            if (user.iron < spec.baseCost) {
                return { success: false, error: 'Insufficient iron' };
            }
            if (!user.subtractIron(spec.baseCost)) {
                return { success: false, error: 'Insufficient iron' };
            }
        }

        // Add to queue
        const queueItem: BuildQueueItem = {
            itemKey,
            itemType,
            completionTime: 0, // Will be calculated when processing queue
            isRecurring: options.isRecurring
        };

        user.buildQueue.push(queueItem);

        // If queue was empty, set start time
        if (user.buildQueue.length === 1) {
            user.buildStartSec = Math.floor(Date.now() / 1000);
        }

        await this.getUserCache().updateUserInCache(context, user);

        if (removedRecurringItem) {
            console.log(`♾️ Removed recurring queue item before adding ${itemType}/${itemKey} for user ${userId}`);
        }

        return { success: true };
    }

    async abortBuildQueue(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<{ abortedCount: number }> {
        const user = await this.getUserCache().getUserByIdWithLock(context, userId);

        if (!user) return { abortedCount: 0 };

        const abortedCount = user.buildQueue.length;
        if (abortedCount === 0) {
            return { abortedCount: 0 };
        }

        user.buildQueue = [];
        user.buildStartSec = null;
        await this.getUserCache().updateUserInCache(context, user);

        return { abortedCount };
    }

    /**
     * Process completed builds for a user
     * This should be called periodically or when checking status
     */
    async processCompletedBuilds(
        userId: number,
        context: LockContext<LocksAtMostAndHas4>,
        options: { now?: number } = {}
    ): Promise<{ completed: BuildQueueItem[] }> {
        const user = await this.getUserCache().getUserByIdWithoutRefreshWithLock(context, userId);

        if (!user) return { completed: [] };

        const now = options.now ?? Math.floor(Date.now() / 1000);
        const completedItems: BuildQueueItem[] = [];
        let queueChanged = false;
        const bonuses = await UserBonusCache.getInstance().getBonuses(context, userId);
        const constructionSpeedFactor = bonuses.constructionSpeedFactor;

        // Process queue
        while (user.buildQueue.length > 0) {
            const currentBuild = user.buildQueue[0];

            // Ensure we have a start time
            let currentBuildStart = user.buildStartSec;
            if (currentBuildStart === null) {
                // Should not happen if queue has items, but recover by setting to now
                currentBuildStart = now;
                user.buildStartSec = currentBuildStart;
                queueChanged = true;
            }

            const spec = TechFactory.getTechSpec(currentBuild.itemKey, currentBuild.itemType);
            if (!spec) {
                // Invalid item in queue, remove it
                user.buildQueue.shift();
                user.buildStartSec = null; // Reset start time for next item (will be set below or next loop)
                queueChanged = true;
                continue;
            }

            const buildTime = spec.buildDurationMinutes * 60;
            const multiplier = TimeMultiplierService.getInstance().getMultiplier();
            const effectiveBuildTime = buildTime / multiplier / constructionSpeedFactor;
            const calculatedCompletionTime = currentBuildStart! + effectiveBuildTime;

            // Check completion with multiplier
            if (now >= calculatedCompletionTime) {
                // Build complete!
                this.applyCompletedBuild(user, currentBuild);
                completedItems.push(currentBuild);
                queueChanged = true;

                // Send notification
                try {
                    const ctx = createLockContext();
                    const locale = user.preferredLocale ?? 'en';
                    const tMsg = await getServerT(locale, 'messages');
                    await this.getMessageCache().createMessage(ctx, userId, tMsg('buildComplete', { name: spec.name }));
                } catch (error) {
                    console.error(`Failed to send build completion notification to user ${userId}:`, error);
                }

                if (currentBuild.isRecurring) {
                    if (user.iron < spec.baseCost) {
                        await this.abortQueueAndNotify(user, userId, spec.name, 1);
                    } else {
                        user.subtractIron(spec.baseCost);
                        user.buildStartSec = Math.floor(calculatedCompletionTime);
                    }
                } else {
                    // Remove from queue
                    user.buildQueue.shift();

                    // Setup next build if any
                    if (user.buildQueue.length > 0) {
                        const nextBuild = user.buildQueue[0];
                        const nextSpec = TechFactory.getTechSpec(nextBuild.itemKey, nextBuild.itemType);

                        if (!nextSpec || user.iron < nextSpec.baseCost) {
                            // Not enough iron to start the next item — abort the entire remaining queue
                            const abortedCount = user.buildQueue.length;
                            const itemName = nextSpec ? nextSpec.name : nextBuild.itemKey;
                            await this.abortQueueAndNotify(user, userId, itemName, abortedCount);
                        } else {
                            // Deduct iron for the next item and start it
                            user.subtractIron(nextSpec.baseCost);
                            user.buildStartSec = Math.floor(calculatedCompletionTime);
                        }
                    } else {
                        user.buildStartSec = null;
                    }
                }
            } else {
                // Current build not finished yet
                break;
            }
        }

        if (queueChanged) {
            await this.getUserCache().updateUserInCache(context, user);
        }

        return { completed: completedItems };
    }

    private removeRecurringQueueItem(user: User): boolean {
        const recurringIndex = user.buildQueue.findIndex((item) => item.isRecurring);
        if (recurringIndex === -1) {
            return false;
        }

        user.buildQueue.splice(recurringIndex, user.buildQueue.length - recurringIndex);
        if (user.buildQueue.length === 0) {
            user.buildStartSec = null;
        }

        return true;
    }

    private async abortQueueAndNotify(user: User, userId: number, itemName: string, abortedCount: number): Promise<void> {
        user.buildQueue = [];
        user.buildStartSec = null;

        try {
            const ctx = createLockContext();
            const locale = user.preferredLocale ?? 'en';
            const tMsg = await getServerT(locale, 'messages');
            await this.getMessageCache().createMessage(ctx, userId,
                tMsg('buildQueueAborted', { name: itemName, count: abortedCount }));
        } catch (error) {
            console.error(`Failed to send queue abort notification to user ${userId}:`, error);
        }
    }

    private applyCompletedBuild(user: User, build: BuildQueueItem): void {
        const itemKey = build.itemKey;

        // Update tech counts
        if (itemKey in user.techCounts) {
            (user.techCounts as unknown as Record<string, number>)[itemKey]++;
        }

        // If it's a defense item, update current values
        if (build.itemType === 'defense') {
            // Simple approach: Add the stats of the new item to current values
            // This effectively "heals" the amount the new item provides
            if (itemKey === 'ship_hull') user.hullCurrent += 100; // Example value
            if (itemKey === 'kinetic_armor') user.armorCurrent += 100;
            if (itemKey === 'energy_shield') user.shieldCurrent += 100;

            // Note: Real max values would be calculated from tech counts * base stats
        }

        // Award score based on iron cost (builds no longer award XP)
        const spec = TechFactory.getTechSpec(build.itemKey, build.itemType);
        if (!spec) return;

        const scoreReward = Math.floor(spec.baseCost / 100);
        user.addScore(scoreReward);
    }

    /**
     * Get detailed analysis of the user's current tech loadout
     */
    async getTechLoadoutAnalysis(
        userId: number,
        context: LockContext<LocksAtMostAndHas4>
    ) {
        const user = await this.getUserCache().getUserByIdWithLock(context, userId);

        if (!user) {
            throw new Error(`User ${userId} not found`);
        }

        return TechFactory.calculateTotalEffects(user.techCounts);
    }

    /**
     * Calculate max defense values including research factors and optional level multiplier.
     * @param levelMultiplier Optional level multiplier (1.15^(level-1)). Defaults to 1.0.
     */
    static calculateMaxDefense(techCounts: TechCounts, techTree: TechTree, levelMultiplier: number = 1.0): { hull: number; armor: number; shield: number } {
        const stackedBase = TechFactory.calculateStackedBaseDefense(techCounts);

        // Get research factors (percentage values, e.g. 100 = 100%)
        const hullFactor = getResearchEffectFromTree(techTree, ResearchType.HullStrength) / 100;
        const armorFactor = getResearchEffectFromTree(techTree, ResearchType.ArmorEffectiveness) / 100;
        const shieldFactor = getResearchEffectFromTree(techTree, ResearchType.ShieldEffectiveness) / 100;

        return {
            hull: Math.round(stackedBase.hull * hullFactor * levelMultiplier),
            armor: Math.round(stackedBase.armor * armorFactor * levelMultiplier),
            shield: Math.round(stackedBase.shield * shieldFactor * levelMultiplier)
        };
    }

    static getDefenseStats(techCounts: TechCounts, techTree: TechTree, currentValues: { hull: number; armor: number; shield: number }, levelMultiplier: number = 1.0, regenRates: { hull: number; armor: number; shield: number } = { hull: 1, armor: 1, shield: 1 }): DefenseValues {
        const maxStats = this.calculateMaxDefense(techCounts, techTree, levelMultiplier);
        return {
            hull: {
                name: 'Ship Hull',
                current: currentValues.hull,
                max: maxStats.hull,
                regenRate: regenRates.hull
            },
            armor: {
                name: 'Kinetic Armor',
                current: currentValues.armor,
                max: maxStats.armor,
                regenRate: regenRates.armor
            },
            shield: {
                name: 'Energy Shield',
                current: currentValues.shield,
                max: maxStats.shield,
                regenRate: regenRates.shield
            }
        };
    }
}
