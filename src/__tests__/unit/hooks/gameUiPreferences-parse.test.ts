import { describe, expect, test } from 'vitest';
import { parseGameUiPreferences, DEFAULT_GAME_UI_PREFERENCES } from '@/lib/client/hooks/useGameUiPreferences';
import { MAX_ZOOM, MIN_ZOOM } from '@shared/viewportConstants';

describe('parseGameUiPreferences', () => {
  test('parseGameUiPreferences_nothingStored_returnsDefaults', () => {
    expect(parseGameUiPreferences(null, null, null)).toEqual(DEFAULT_GAME_UI_PREFERENCES);
  });

  test('parseGameUiPreferences_onlyLegacyKeys_usesLegacyZoomAndDebug', () => {
    const result = parseGameUiPreferences(null, 'true', '1.5');
    expect(result.debugDrawingsEnabled).toBe(true);
    expect(result.zoom).toBe(1.5);
  });

  test('parseGameUiPreferences_newAndLegacyKeys_prefersNewKey', () => {
    const result = parseGameUiPreferences(JSON.stringify({ zoom: 1.2, debugDrawingsEnabled: false }), 'true', '1.9');
    expect(result.zoom).toBe(1.2);
    expect(result.debugDrawingsEnabled).toBe(false);
  });

  test('parseGameUiPreferences_zoomOutOfRange_isClamped', () => {
    expect(parseGameUiPreferences(JSON.stringify({ zoom: 99 }), null, null).zoom).toBe(MAX_ZOOM);
    expect(parseGameUiPreferences(JSON.stringify({ zoom: -5 }), null, null).zoom).toBe(MIN_ZOOM);
  });

  test('parseGameUiPreferences_wrongTypes_fallBackToDefaults', () => {
    const result = parseGameUiPreferences(JSON.stringify({ navOpen: 'yes', zoom: 'big' }), null, null);
    expect(result.navOpen).toBe(DEFAULT_GAME_UI_PREFERENCES.navOpen);
    expect(result.zoom).toBe(DEFAULT_GAME_UI_PREFERENCES.zoom);
  });
});
