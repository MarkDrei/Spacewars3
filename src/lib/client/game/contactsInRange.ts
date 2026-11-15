import type { WorldData } from '@shared/types/gameTypes';
import { calculateToroidalDistance } from '@shared/physics';
import { HAIL_RANGE, type ContactId } from '@/shared/quests/npcArchetypes';

/** Mission contacts whose ship is within hail range of the player's ship in the world snapshot. */
export function contactsInHailRange(worldData: WorldData | null | undefined, playerShipId: number | undefined): ContactId[] {
  const ship = worldData?.spaceObjects.find(obj => obj.id === playerShipId && obj.type === 'player_ship');
  if (!worldData || !ship) return [];

  return worldData.spaceObjects.flatMap(obj => {
    if (obj.npcDisposition !== 'friendly' || !obj.contactId) return [];
    const distance = calculateToroidalDistance(ship, obj, worldData.worldSize);
    return distance <= HAIL_RANGE ? [obj.contactId] : [];
  });
}
