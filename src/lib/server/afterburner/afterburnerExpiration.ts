/**
 * Afterburner expiration helper.
 *
 * Called from routes that hold both USER_LOCK and WORLD_LOCK (e.g. ship-stats,
 * afterburner activate) to check whether an active boost has expired and, if so,
 * cap the ship speed back at the user's normal maxSpeed.
 *
 * We cannot run this inside WorldCache.getWorldFromCache because that context
 * only holds WORLD_LOCK — accessing UserBonusCache requires USER_LOCK.
 */

import type { SpaceObject } from '@/lib/server/world/world';
import { AfterburnerService } from './AfterburnerService';
import type { AfterburnerConfig } from './afterburnerTypes';

/**
 * Check whether the given user's afterburner boost has expired.
 * If expired, caps the ship speed at the user's normal maxShipSpeed.
 *
 * @returns `true` if the boost was expired (and speed was capped), `false` otherwise.
 */
export function checkAndExpireAfterburner(
  userId: number,
  playerShip: SpaceObject,
  maxShipSpeed: number,
  config: AfterburnerConfig,
): boolean {
  const afterburnerService = AfterburnerService.getInstance();
  const result = afterburnerService.checkAndExpire(userId, config);
  if (result?.expired) {
    // Cap speed at normal maxSpeed (preserves any manual speed reduction below max)
    playerShip.speed = Math.min(playerShip.speed, maxShipSpeed);
    return true;
  }
  return false;
}
