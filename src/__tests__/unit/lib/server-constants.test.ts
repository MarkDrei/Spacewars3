/**
 * Tests for server constants module
 * Verifies that constants import correctly from shared module
 * and that ship starting positions are correctly calculated as world center
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SHIP_START_X,
  DEFAULT_SHIP_START_Y,
  DEFAULT_SHIP_START_SPEED,
  DEFAULT_SHIP_START_ANGLE,
} from '../../../lib/server/constants';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';

describe('serverConstants_imports_fromSharedModule', () => {
  it('serverConstants_defaultShipStartX_isWorldCenterX', () => {
    expect(DEFAULT_SHIP_START_X).toBe(DEFAULT_WORLD_WIDTH / 2);
  });

  it('serverConstants_defaultShipStartY_isWorldCenterY', () => {
    expect(DEFAULT_SHIP_START_Y).toBe(DEFAULT_WORLD_HEIGHT / 2);
  });

  it('serverConstants_defaultShipStartSpeed_isZero', () => {
    expect(DEFAULT_SHIP_START_SPEED).toBe(0);
  });

  it('serverConstants_defaultShipStartAngle_isZero', () => {
    expect(DEFAULT_SHIP_START_ANGLE).toBe(0);
  });

  it('serverConstants_shipStartPosition_isNumeric', () => {
    expect(typeof DEFAULT_SHIP_START_X).toBe('number');
    expect(typeof DEFAULT_SHIP_START_Y).toBe('number');
    expect(Number.isFinite(DEFAULT_SHIP_START_X)).toBe(true);
    expect(Number.isFinite(DEFAULT_SHIP_START_Y)).toBe(true);
  });

  it('serverConstants_shipStartPosition_isWithinWorldBounds', () => {
    expect(DEFAULT_SHIP_START_X).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SHIP_START_X).toBeLessThanOrEqual(DEFAULT_WORLD_WIDTH);
    expect(DEFAULT_SHIP_START_Y).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SHIP_START_Y).toBeLessThanOrEqual(DEFAULT_WORLD_HEIGHT);
  });

  it('serverConstants_currentWorldSize_yields2500AsCenter', () => {
    // With current 5000x5000 world, center should be (2500, 2500)
    // This test documents the state after world size increase (Goal 8)
    expect(DEFAULT_WORLD_WIDTH).toBe(5000);
    expect(DEFAULT_WORLD_HEIGHT).toBe(5000);
    expect(DEFAULT_SHIP_START_X).toBe(2500);
    expect(DEFAULT_SHIP_START_Y).toBe(2500);
  });
});
