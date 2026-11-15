import { describe, it, expect } from 'vitest';
import { contactsInHailRange } from '@/lib/client/game/contactsInRange';
import { HAIL_RANGE, type ContactId } from '@/shared/quests/npcArchetypes';
import type { SpaceObject, WorldData } from '@shared/types/gameTypes';

const SHIP_ID = 7;

const object = (overrides: Partial<SpaceObject>): SpaceObject => ({
  id: 1, type: 'asteroid', x: 0, y: 0, speed: 0, angle: 0, last_position_update_ms: 0, picture_id: 1,
  ...overrides,
});

const ship = (x: number, y: number): SpaceObject => object({ id: SHIP_ID, type: 'player_ship', x, y });

const contact = (contactId: ContactId, x: number, y: number): SpaceObject =>
  object({ id: 2_100_000_001, type: 'npc_ship', x, y, npcDisposition: 'friendly', contactId });

const world = (...spaceObjects: SpaceObject[]): WorldData => ({
  worldSize: { width: 5000, height: 5000 },
  spaceObjects,
  currentTime: 0,
});

describe('contactsInHailRange', () => {
  it('contactsInHailRange_contactExactlyAtHailRange_isInRange', () => {
    expect(contactsInHailRange(world(ship(1000, 1000), contact('vess', 1000 + HAIL_RANGE, 1000)), SHIP_ID)).toEqual(['vess']);
  });

  it('contactsInHailRange_contactJustOutsideHailRange_isNotInRange', () => {
    expect(contactsInHailRange(world(ship(1000, 1000), contact('vess', 1001 + HAIL_RANGE, 1000)), SHIP_ID)).toEqual([]);
  });

  it('contactsInHailRange_contactAcrossTheWorldEdge_usesTheShortestWay', () => {
    expect(contactsInHailRange(world(ship(4900, 100), contact('tam', 100, 4900)), SHIP_ID)).toEqual(['tam']);
  });

  it('contactsInHailRange_severalContacts_returnsOnlyThoseInRange', () => {
    const data = world(ship(1000, 1000), contact('vess', 1100, 1000), contact('quill', 3000, 3000), contact('halden', 1000, 1300));

    expect(contactsInHailRange(data, SHIP_ID)).toEqual(['vess', 'halden']);
  });

  it('contactsInHailRange_hostileShipsNearby_areIgnored', () => {
    const pirate = object({ id: 1_001_001, type: 'npc_ship', x: 1010, y: 1000, npcDisposition: 'hostile' });

    expect(contactsInHailRange(world(ship(1000, 1000), pirate), SHIP_ID)).toEqual([]);
  });

  it('contactsInHailRange_playerShipMissing_returnsNothing', () => {
    expect(contactsInHailRange(world(contact('vess', 0, 0)), SHIP_ID)).toEqual([]);
    expect(contactsInHailRange(world(ship(0, 0), contact('vess', 0, 0)), undefined)).toEqual([]);
  });

  it('contactsInHailRange_noWorldData_returnsNothing', () => {
    expect(contactsInHailRange(null, SHIP_ID)).toEqual([]);
    expect(contactsInHailRange(undefined, SHIP_ID)).toEqual([]);
  });
});
