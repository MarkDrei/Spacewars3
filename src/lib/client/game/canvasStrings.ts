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
  friendlyShip: string;
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
  actionTapToHail: string;
  /** Shown instead of the hail action while the contact is out of hail range. */
  hailTooFar: string;
  /** Warning line for NPC ships that attack on sight. */
  aggressiveShip: string;
  levelTooFarToAttack: string;
  /** Names of mission contacts by contact id. */
  contactNames: Readonly<Record<string, string>>;
  /** Names of stations and points of interest by location id. */
  locationNames: Readonly<Record<string, string>>;
}

export const defaultCanvasStrings: CanvasStrings = {
  ship: 'Ship',
  npcShip: 'NPC Ship',
  enemyShip: 'Enemy Ship',
  friendlyShip: 'Friendly Contact',
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
  actionTapToHail: 'Action: tap again to hail',
  hailTooFar: 'Fly closer to hail',
  aggressiveShip: 'Hunted by your mission: attacks on sight',
  levelTooFarToAttack: 'Level difference too large to attack this target.',
  contactNames: {},
  locationNames: {},
};
