import { beforeEach, describe, expect, test } from 'vitest';
import { debugState } from '@/lib/client/debug/debugState';

describe('debugState', () => {
  beforeEach(() => {
    debugState.setDebugDrawingsEnabled(false);
  });

  test('debugDrawingsEnabled_initialState_isDisabled', () => {
    expect(debugState.debugDrawingsEnabled).toBe(false);
  });

  test('setDebugDrawingsEnabled_true_updatesState', () => {
    debugState.setDebugDrawingsEnabled(true);

    expect(debugState.debugDrawingsEnabled).toBe(true);
  });
});