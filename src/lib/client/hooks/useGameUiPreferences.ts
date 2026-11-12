import { useSyncExternalStore } from 'react';
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@shared/viewportConstants';

/**
 * Game page UI preferences (zoom, open panels, click modes) persisted in localStorage.
 *
 * localStorage is treated as an external store (useSyncExternalStore): the server snapshot
 * returns defaults, the client reads storage directly, and updates write through to storage.
 * Legacy single-value keys for zoom and debug drawings are still read as fallback and written
 * so older clients keep working.
 */

export const GAME_UI_PREFERENCES_STORAGE_KEY = 'game-ui-preferences';
export const LEGACY_GAME_UI_DEBUG_STORAGE_KEY = 'game-ui-debug-enabled';
export const LEGACY_GAME_UI_ZOOM_STORAGE_KEY = 'game-ui-zoom';

export type GameUiPreferences = {
  debugDrawingsEnabled: boolean;
  zoom: number;
  navOpen: boolean;
  teleportOpen: boolean;
  afterburnerOpen: boolean;
  mobileTapInfoMode: boolean;
  teleportClickMode: boolean;
  attackClickMode: boolean;
};

export const DEFAULT_GAME_UI_PREFERENCES: GameUiPreferences = {
  debugDrawingsEnabled: false,
  zoom: DEFAULT_ZOOM,
  navOpen: false,
  teleportOpen: false,
  afterburnerOpen: false,
  mobileTapInfoMode: false,
  teleportClickMode: false,
  attackClickMode: false,
};

const parseStoredBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);

const parseStoredZoom = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);
};

const parseJson = (raw: string | null): unknown => (raw === null ? undefined : JSON.parse(raw));

/** Parses the raw storage values; invalid or missing entries fall back to defaults. */
export const parseGameUiPreferences = (
  rawPreferences: string | null,
  rawLegacyDebug: string | null,
  rawLegacyZoom: string | null,
): GameUiPreferences => {
  const parsed = parseJson(rawPreferences);
  const stored = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  const defaults = DEFAULT_GAME_UI_PREFERENCES;

  return {
    debugDrawingsEnabled:
      parseStoredBoolean(stored?.debugDrawingsEnabled) ?? parseStoredBoolean(parseJson(rawLegacyDebug)) ?? defaults.debugDrawingsEnabled,
    zoom: parseStoredZoom(stored?.zoom) ?? parseStoredZoom(parseJson(rawLegacyZoom)) ?? defaults.zoom,
    navOpen: parseStoredBoolean(stored?.navOpen) ?? defaults.navOpen,
    teleportOpen: parseStoredBoolean(stored?.teleportOpen) ?? defaults.teleportOpen,
    afterburnerOpen: parseStoredBoolean(stored?.afterburnerOpen) ?? defaults.afterburnerOpen,
    mobileTapInfoMode: parseStoredBoolean(stored?.mobileTapInfoMode) ?? defaults.mobileTapInfoMode,
    teleportClickMode: parseStoredBoolean(stored?.teleportClickMode) ?? defaults.teleportClickMode,
    attackClickMode: parseStoredBoolean(stored?.attackClickMode) ?? defaults.attackClickMode,
  };
};

// Snapshot cache: useSyncExternalStore requires a stable reference while storage is unchanged
let cachedRawKey: string | null = null;
let cachedPreferences: GameUiPreferences = DEFAULT_GAME_UI_PREFERENCES;

const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

const getSnapshot = (): GameUiPreferences => {
  try {
    const rawPreferences = localStorage.getItem(GAME_UI_PREFERENCES_STORAGE_KEY);
    const rawLegacyDebug = localStorage.getItem(LEGACY_GAME_UI_DEBUG_STORAGE_KEY);
    const rawLegacyZoom = localStorage.getItem(LEGACY_GAME_UI_ZOOM_STORAGE_KEY);
    const rawKey = JSON.stringify([rawPreferences, rawLegacyDebug, rawLegacyZoom]);
    if (rawKey !== cachedRawKey) {
      cachedRawKey = rawKey;
      cachedPreferences = parseGameUiPreferences(rawPreferences, rawLegacyDebug, rawLegacyZoom);
    }
  } catch (err) {
    if (cachedRawKey !== 'error') {
      console.warn('Failed to load UI preferences from localStorage:', err);
      cachedRawKey = 'error';
      cachedPreferences = DEFAULT_GAME_UI_PREFERENCES;
    }
  }
  return cachedPreferences;
};

const getServerSnapshot = (): GameUiPreferences => DEFAULT_GAME_UI_PREFERENCES;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  // Preferences changed in another tab
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

/** Merges `changes` into the stored preferences and notifies all subscribed components. */
export const updateGameUiPreferences = (changes: Partial<GameUiPreferences>): void => {
  const next: GameUiPreferences = { ...getSnapshot(), ...changes };
  try {
    localStorage.setItem(GAME_UI_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(LEGACY_GAME_UI_DEBUG_STORAGE_KEY, JSON.stringify(next.debugDrawingsEnabled));
    localStorage.setItem(LEGACY_GAME_UI_ZOOM_STORAGE_KEY, JSON.stringify(next.zoom));
  } catch (err) {
    console.warn('Failed to save UI preferences:', err);
    // Keep the change in memory for this session even if storage is unavailable
    cachedPreferences = next;
  }
  notify();
};

const subscribeNoop = () => () => {};

/**
 * Returns the current UI preferences and whether the client has hydrated.
 * Before hydration (server render) the defaults are returned and `isHydrated` is false.
 */
export const useGameUiPreferences = (): { preferences: GameUiPreferences; isHydrated: boolean } => {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isHydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  return { preferences, isHydrated };
};
