import { describe, expect, test, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useGameUiPreferences,
  updateGameUiPreferences,
  DEFAULT_GAME_UI_PREFERENCES,
  GAME_UI_PREFERENCES_STORAGE_KEY,
  LEGACY_GAME_UI_DEBUG_STORAGE_KEY,
  LEGACY_GAME_UI_ZOOM_STORAGE_KEY,
} from '@/lib/client/hooks/useGameUiPreferences';

describe('useGameUiPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('useGameUiPreferences_storedPreferences_returnedOnClient', () => {
    localStorage.setItem(GAME_UI_PREFERENCES_STORAGE_KEY, JSON.stringify({ navOpen: true, zoom: 1.4 }));

    const { result } = renderHook(() => useGameUiPreferences());

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.preferences.navOpen).toBe(true);
    expect(result.current.preferences.zoom).toBe(1.4);
  });

  test('useGameUiPreferences_update_rerendersAndPersistsIncludingLegacyKeys', () => {
    const { result } = renderHook(() => useGameUiPreferences());

    act(() => {
      updateGameUiPreferences({ zoom: 1.6, debugDrawingsEnabled: true });
    });

    expect(result.current.preferences.zoom).toBe(1.6);
    expect(result.current.preferences.debugDrawingsEnabled).toBe(true);
    expect(JSON.parse(localStorage.getItem(GAME_UI_PREFERENCES_STORAGE_KEY) ?? '{}')).toMatchObject({ zoom: 1.6, debugDrawingsEnabled: true });
    expect(localStorage.getItem(LEGACY_GAME_UI_ZOOM_STORAGE_KEY)).toBe('1.6');
    expect(localStorage.getItem(LEGACY_GAME_UI_DEBUG_STORAGE_KEY)).toBe('true');
  });

  test('useGameUiPreferences_unchangedStorage_returnsStableReference', () => {
    const { result, rerender } = renderHook(() => useGameUiPreferences());
    const first = result.current.preferences;
    rerender();
    expect(result.current.preferences).toBe(first);
  });

  test('useGameUiPreferences_corruptStorage_returnsDefaultsAndWarns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(GAME_UI_PREFERENCES_STORAGE_KEY, '{not json');

    const { result } = renderHook(() => useGameUiPreferences());

    expect(result.current.preferences).toEqual(DEFAULT_GAME_UI_PREFERENCES);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
