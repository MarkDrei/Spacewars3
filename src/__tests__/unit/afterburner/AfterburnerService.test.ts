import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AfterburnerService } from '@/lib/server/afterburner/AfterburnerService';

const USER_ID = 42;
const DURATION_MS = 10_000; // 10 s
const COOLDOWN_MS = 20_000; // 20 s
const BOOSTED_SPEED = 500;
const DEFAULT_MULTIPLIER = 1;

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

  // ── activate / getState ──

  it('activate_storesState_stateRetrievable', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    const state = service.getState(USER_ID);
    expect(state).not.toBeNull();
    expect(state!.userId).toBe(USER_ID);
    expect(state!.durationMs).toBe(DURATION_MS);
    expect(state!.cooldownMs).toBe(COOLDOWN_MS);
    expect(state!.boostedSpeed).toBe(BOOSTED_SPEED);
  });

  // ── isActive ──

  it('isActive_withinDuration_returnsTrue', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS - 1);

    expect(service.isActive(USER_ID, DEFAULT_MULTIPLIER)).toBe(true);
  });

  it('isActive_afterDuration_returnsFalse', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS);

    expect(service.isActive(USER_ID, DEFAULT_MULTIPLIER)).toBe(false);
  });

  // ── isOnCooldown ──

  it('isOnCooldown_afterDurationBeforeCooldownEnd_returnsTrue', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS + 1);

    expect(service.isOnCooldown(USER_ID, DEFAULT_MULTIPLIER)).toBe(true);
  });

  it('isOnCooldown_afterCooldownEnd_returnsFalse', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS + COOLDOWN_MS);

    expect(service.isOnCooldown(USER_ID, DEFAULT_MULTIPLIER)).toBe(false);
  });

  // ── canActivate ──

  it('canActivate_noState_returnsTrue', () => {
    expect(service.canActivate(USER_ID, DEFAULT_MULTIPLIER)).toBe(true);
  });

  it('canActivate_duringBoost_returnsFalse', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS / 2);

    expect(service.canActivate(USER_ID, DEFAULT_MULTIPLIER)).toBe(false);
  });

  it('canActivate_duringCooldown_returnsFalse', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS + COOLDOWN_MS / 2);

    expect(service.canActivate(USER_ID, DEFAULT_MULTIPLIER)).toBe(false);
  });

  it('canActivate_afterCooldownEnd_returnsTrue', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS + COOLDOWN_MS);

    expect(service.canActivate(USER_ID, DEFAULT_MULTIPLIER)).toBe(true);
  });

  it('canActivate_afterCooldownEnd_cleansUpState', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS + COOLDOWN_MS);

    service.canActivate(USER_ID, DEFAULT_MULTIPLIER);
    expect(service.getState(USER_ID)).toBeNull();
  });

  // ── checkAndExpire ──

  it('checkAndExpire_boostExpired_returnsNonNull', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS);

    const result = service.checkAndExpire(USER_ID, DEFAULT_MULTIPLIER);
    expect(result).not.toBeNull();
    expect(result!.expired).toBe(true);
  });

  it('checkAndExpire_boostNotExpired_returnsNull', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS - 1);

    expect(service.checkAndExpire(USER_ID, DEFAULT_MULTIPLIER)).toBeNull();
  });

  it('checkAndExpire_noState_returnsNull', () => {
    expect(service.checkAndExpire(USER_ID, DEFAULT_MULTIPLIER)).toBeNull();
  });

  // ── timeMultiplier ──

  it('timeMultiplier_doublesEffectiveElapsedTime', () => {
    const multiplier = 2;
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    // With 2× multiplier, boost should expire in half the wall-clock time
    vi.advanceTimersByTime(DURATION_MS / 2 - 1);
    expect(service.isActive(USER_ID, multiplier)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(service.isActive(USER_ID, multiplier)).toBe(false);
  });

  it('timeMultiplier_changesMidBoost_affectsRemainingTime', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    // Advance 4 000 ms at 1× → effective = 4 000 ms, remaining = 6 000 ms
    vi.advanceTimersByTime(4_000);
    expect(service.getBoostRemainingMs(USER_ID, 1)).toBe(6_000);

    // Now switch to 2× — effective = 4 000 × 2 = 8 000 ms, remaining = 2 000 ms
    expect(service.getBoostRemainingMs(USER_ID, 2)).toBe(2_000);

    // Advance 1 000 ms more → wall = 5 000 ms, effective at 2× = 10 000 ms → boost ends
    vi.advanceTimersByTime(1_000);
    expect(service.isActive(USER_ID, 2)).toBe(false);
  });

  // ── remaining helpers ──

  it('getBoostRemainingMs_duringBoost_returnsPositive', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(3_000);

    expect(service.getBoostRemainingMs(USER_ID, DEFAULT_MULTIPLIER)).toBe(7_000);
  });

  it('getBoostRemainingMs_afterBoost_returnsZero', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS);

    expect(service.getBoostRemainingMs(USER_ID, DEFAULT_MULTIPLIER)).toBe(0);
  });

  it('getCooldownRemainingMs_duringCooldown_returnsPositive', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS + 5_000);

    expect(service.getCooldownRemainingMs(USER_ID, DEFAULT_MULTIPLIER)).toBe(15_000);
  });

  it('getCooldownRemainingMs_afterCooldown_returnsZero', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    vi.advanceTimersByTime(DURATION_MS + COOLDOWN_MS);

    expect(service.getCooldownRemainingMs(USER_ID, DEFAULT_MULTIPLIER)).toBe(0);
  });

  // ── clearState ──

  it('clearState_removesState', () => {
    service.activate(USER_ID, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    service.clearState(USER_ID);

    expect(service.getState(USER_ID)).toBeNull();
    expect(service.isActive(USER_ID, DEFAULT_MULTIPLIER)).toBe(false);
  });

  // ── getActiveUserIds ──

  it('getActiveUserIds_returnsStoredUserIds', () => {
    service.activate(1, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);
    service.activate(2, DURATION_MS, COOLDOWN_MS, BOOSTED_SPEED);

    const ids = service.getActiveUserIds();
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toHaveLength(2);
  });

  // ── singleton ──

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
