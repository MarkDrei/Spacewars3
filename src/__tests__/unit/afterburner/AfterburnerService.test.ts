import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AfterburnerService } from '@/lib/server/afterburner/AfterburnerService';
import type { AfterburnerConfig } from '@/lib/server/afterburner/afterburnerTypes';

const USER_ID = 42;
const DEFAULT_CONFIG: AfterburnerConfig = {
  timeMultiplier: 1,
  fuelCapacityMs: 10_000,
  cooldownMs: 20_000,
  boostedSpeed: 500,
};

function makeConfig(overrides: Partial<AfterburnerConfig> = {}): AfterburnerConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

describe('AfterburnerService', () => {
  let service: AfterburnerService;

  beforeEach(() => {
    vi.useFakeTimers();
    AfterburnerService.resetInstance();
    service = AfterburnerService.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('activate_storesActiveState_withFullFuel', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    const state = service.getState(USER_ID);
    expect(state).not.toBeNull();
    expect(state!.userId).toBe(USER_ID);
    expect(state!.fuelRatio).toBe(1);
    expect(state!.isActive).toBe(true);
    expect(state!.boostedSpeed).toBe(DEFAULT_CONFIG.boostedSpeed);
  });

  it('activate_returnsImmediateSnapshot_withFullFuel', () => {
    const status = service.activate(USER_ID, DEFAULT_CONFIG);

    expect(status.isActive).toBe(true);
    expect(status.fuelRemainingMs).toBe(DEFAULT_CONFIG.fuelCapacityMs);
    expect(status.fuelCapacityMs).toBe(DEFAULT_CONFIG.fuelCapacityMs);
    expect(status.fuelPercent).toBe(100);
    expect(status.boostRemainingMs).toBe(DEFAULT_CONFIG.fuelCapacityMs);
  });

  it('isActive_withinFuelDuration_returnsTrue', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    vi.advanceTimersByTime(DEFAULT_CONFIG.fuelCapacityMs - 1);

    expect(service.isActive(USER_ID, DEFAULT_CONFIG)).toBe(true);
  });

  it('isActive_afterFuelDepletes_returnsFalse', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    vi.advanceTimersByTime(DEFAULT_CONFIG.fuelCapacityMs);

    expect(service.isActive(USER_ID, DEFAULT_CONFIG)).toBe(false);
  });

  it('canActivate_noState_returnsTrue', () => {
    expect(service.canActivate(USER_ID, DEFAULT_CONFIG)).toBe(true);
  });

  it('canActivate_duringBoost_returnsFalse', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    vi.advanceTimersByTime(2_000);

    expect(service.canActivate(USER_ID, DEFAULT_CONFIG)).toBe(false);
  });

  it('deactivate_midBoost_preservesFuelForLaterReuse', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    vi.advanceTimersByTime(4_000);

    const status = service.deactivate(USER_ID, DEFAULT_CONFIG);

    expect(status).not.toBeNull();
    expect(status!.isActive).toBe(false);
    expect(status!.fuelPercent).toBeCloseTo(60, 3);
    expect(service.canActivate(USER_ID, DEFAULT_CONFIG)).toBe(true);
  });

  it('canActivate_belowThresholdAfterManualStop_returnsFalse', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    vi.advanceTimersByTime(8_000);
    service.deactivate(USER_ID, DEFAULT_CONFIG);

    expect(service.canActivate(USER_ID, DEFAULT_CONFIG)).toBe(false);
    expect(service.getTimeToActivationMs(USER_ID, DEFAULT_CONFIG)).toBeCloseTo(2_666.666, 0);
  });

  it('getBoostRemainingMs_duringBoost_returnsCurrentFuelTime', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    vi.advanceTimersByTime(3_000);

    expect(service.getBoostRemainingMs(USER_ID, DEFAULT_CONFIG)).toBe(7_000);
  });

  it('getCooldownRemainingMs_afterFuelDepletes_returnsTimeToFullRecharge', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    vi.advanceTimersByTime(15_000);

    expect(service.getCooldownRemainingMs(USER_ID, DEFAULT_CONFIG)).toBe(15_000);
  });

  it('checkAndExpire_whenBoostRunsOut_returnsExpired', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    vi.advanceTimersByTime(DEFAULT_CONFIG.fuelCapacityMs);

    const result = service.checkAndExpire(USER_ID, DEFAULT_CONFIG);
    expect(result).toEqual({ expired: true });
  });

  it('fullRecharge_cleansUpState', () => {
    service.activate(USER_ID, DEFAULT_CONFIG);

    vi.advanceTimersByTime(DEFAULT_CONFIG.fuelCapacityMs + DEFAULT_CONFIG.cooldownMs);

    expect(service.getStatus(USER_ID, DEFAULT_CONFIG).fuelPercent).toBe(100);
    expect(service.getState(USER_ID)).toBeNull();
  });

  it('timeMultiplier_doublesDrainAndRechargeSpeed', () => {
    const config = makeConfig({ timeMultiplier: 2 });
    service.activate(USER_ID, config);

    vi.advanceTimersByTime(4_000);
    expect(service.getStatus(USER_ID, config).fuelPercent).toBeCloseTo(20, 3);

    vi.advanceTimersByTime(1_000);
    expect(service.isActive(USER_ID, config)).toBe(false);

    vi.advanceTimersByTime(2_000);
    expect(service.getStatus(USER_ID, config).fuelPercent).toBeCloseTo(20, 3);
  });

  it('getInstance_returnsSameInstance', () => {
    const a = AfterburnerService.getInstance();
    const b = AfterburnerService.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance_createsNewInstance', () => {
    const before = AfterburnerService.getInstance();
    AfterburnerService.resetInstance();
    const after = AfterburnerService.getInstance();
    expect(before).not.toBe(after);
  });
});