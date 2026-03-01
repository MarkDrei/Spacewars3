import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { World } from '@/lib/server/world/world';
import { TechService } from '@/lib/server/techs/TechService';
import { createLockContext, LockContext, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const emptyCtx = createLockContext();

    // Get typed cache manager singleton
    const userWorldCache = UserCache.getInstance2();

    const worldCache = WorldCache.getInstance();
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        // Get world and user data safely (we have both locks)
        const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
        const world = worldCache.getWorldFromCache(worldContext);

        if (!user) {
          console.log(`❌ User not found: ${session.userId}`);
          throw new ApiError(404, 'User not found');
        }

        // Fetch bonuses (cache hit — already computed by getUserByIdWithLock)
        const bonuses = await UserBonusCache.getInstance().getBonuses(userContext, user.id);

        // Continue with ship stats logic
        return await getShipStats(worldContext, world, user, bonuses);
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getShipStats(
  worldContext: LockContext<LocksAtMostAndHas6>,
  world: World,
  user: User,
  bonuses: Awaited<ReturnType<typeof UserBonusCache.prototype.getBonuses>>
): Promise<NextResponse> {
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);

  // Update defense values based on elapsed time since last regen (using bonused rates)
  const now = Math.floor(Date.now() / 1000);
  user.updateDefenseValues(now, bonuses);

  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);

  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }

  // Use bonused max ship speed (includes research × level × commander × afterburner)
  const maxSpeed = bonuses.maxShipSpeed;

  // Calculate defense values using actual current values from database
  const currentValues = {
    hull: user.hullCurrent,
    armor: user.armorCurrent,
    shield: user.shieldCurrent
  };
  const regenRates = {
    hull: bonuses.hullRepairSpeed,
    armor: bonuses.armorRepairSpeed,
    shield: bonuses.shieldRechargeRate
  };
  const defenseValues = TechService.getDefenseStats(
    user.techCounts,
    user.techTree,
    currentValues,
    bonuses.levelMultiplier,
    regenRates
  );

  const responseData = {
    x: playerShip.x,
    y: playerShip.y,
    speed: playerShip.speed,
    angle: playerShip.angle,
    maxSpeed: maxSpeed,
    last_position_update_ms: playerShip.last_position_update_ms,
    defenseValues
  };

  return NextResponse.json(responseData);
}
