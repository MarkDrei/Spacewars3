/**
 * Translated string labels injected from the React layer into the canvas renderer.
 * The canvas cannot use React hooks directly, so translated strings must be
 * passed from a `useTranslations` call in a parent component.
 *
 * Stat-value fields (speed, angle, distance, level) are plain labels.
 * The renderer appends `: <value>` itself so German "Geschwindigkeit" becomes
 * "Geschwindigkeit: 2.34" without hardcoding a separator in the translation key.
 */
export interface CanvasStrings {
  // Object type labels
  ship: string;
  npcShip: string;
  enemyShip: string;
  starbase: string;
  asteroid: string;
  shipWreck: string;
  escapePod: string;
  collectible: string;
  spaceObject: string;
  // HUD stat labels (renderer appends ": <value>")
  speed: string;
  angle: string;
  distance: string;
  level: string;
  actionTapToDock: string;
  levelTooFarToAttack: string;
}

export const defaultCanvasStrings: CanvasStrings = {
  ship: 'Ship',
  npcShip: 'NPC Ship',
  enemyShip: 'Enemy Ship',
  starbase: 'Starbase',
  asteroid: 'Asteroid',
  shipWreck: 'Ship Wreck',
  escapePod: 'Escape Pod',
  collectible: 'Collectible',
  spaceObject: 'Space Object',
  speed: 'Speed',
  angle: 'Angle',
  distance: 'Distance',
  level: 'Level',
  actionTapToDock: 'Action: tap again to dock',
  levelTooFarToAttack: 'Level difference too large to attack this target.',
};
