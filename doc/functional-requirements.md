# Functional Requirements — Spacewars Ironstrike

---

## Scope & Purpose

This document is the **authoritative feature overview** for _Spacewars Ironstrike_. It describes all user-facing features and the rules governing them.

**Scope:** All pages and features, including the admin toolset. Technical architecture and infrastructure details are in the [arc42 architecture document](./architecture/arc42-architecture.md).

---

## Overview

Spacewars Ironstrike is a browser-based multi-player 2D space exploration game. Players navigate a spaceship through a toroidal world, manage resources, engage in combat, and develop their ship through research and manufacturing.

**Authentication**: Access to the game requires user registration and login via the [Authentication & Session Management](#cap01-authentication--session-management) system. Sessions persist across browser visits.

**Player Dashboard**: Upon login, players view the [Game Hub & Player Status](#cap02-game-hub--player-status) dashboard, which displays character progression, defense statistics, and active battles.

**Language Support**: The UI and player-facing notifications are available in English and German. Players can change their preferred language from the Profile page, and the preference persists across visits.

**Core Gameplay**: Players navigate the toroidal world through the [Exploration & Navigation](#cap03-exploration--navigation) system. The game world wraps at boundaries; navigation is controlled via click-to-move, speed/angle inputs, and teleportation when available.

**Core Economy**: Iron is the primary game currency, acquired through:

- **[Resource Gathering & Harvesting](#cap04-resource-gathering--harvesting)**: Passive iron generation over time, plus active collection from collectible objects (asteroids, shipwrecks, escape pods). Combat victories also transfer iron from the defeated player.
- **[Combat System](#cap05-combat-system)**: Direct player-vs-player combat generates iron rewards. Combat is level-based, restricting participation between similarly-leveled players.
- **[Research & Technology Tree](#cap06-research--technology-tree)**: Iron is spent to research technologies that unlock new capabilities.
- **[Factory & Manufacturing](#cap07-factory--manufacturing)**: Iron is spent to manufacture weapons and defensive systems.
- **[Inventory Management](#cap08-inventory-management)**: Commanders are managed and assigned to bridge slots to provide ship stat bonuses.

**Administration**: Authorized administrators access [Admin Tools](#cap09-admin-tools) to adjust time multipliers, spawn space objects, and view game statistics.

---

## Table of Contents

- [Overview](#overview)
- [Capabilities](#capabilities)
  - [Cap01: Authentication & Session Management](#cap01-authentication--session-management)
    - [Cap01_Feat001: Account Registration](#cap01_feat001-account-registration)
    - [Cap01_Feat002: Login & Session](#cap01_feat002-login--session)
    - [Cap01_Feat003: Password Management](#cap01_feat003-password-management)
    - [Cap01_Feat004: Email Verification](#cap01_feat004-email-verification)
    - [Cap01_Feat005: Profile Customization](#cap01_feat005-profile-customization)
  - [Cap02: Game Hub & Player Status](#cap02-game-hub--player-status)
    - [Cap02_Feat001: Player Stats & Progression](#cap02_feat001-player-stats--progression)
    - [Cap02_Feat002: Defense Status Display](#cap02_feat002-defense-status-display)
    - [Cap02_Feat003: Tech Inventory Display](#cap02_feat003-tech-inventory-display)
    - [Cap02_Feat004: Leaderboard](#cap02_feat004-leaderboard)
    - [Cap02_Feat005: Battle History](#cap02_feat005-battle-history)
  - [Cap03: Exploration & Navigation](#cap03-exploration--navigation)
    - [Cap03_Feat001: Ship Navigation](#cap03_feat001-ship-navigation)
    - [Cap03_Feat002: World & Viewport](#cap03_feat002-world--viewport)
    - [Cap03_Feat003: Afterburner](#cap03_feat003-afterburner)
    - [Cap03_Feat004: Teleportation](#cap03_feat004-teleportation)
    - [Cap03_Feat005: Starbase Interaction](#cap03_feat005-starbase-interaction)
  - [Cap04: Resource Gathering & Harvesting](#cap04-resource-gathering--harvesting)
    - [Cap04_Feat001: Passive Iron Income](#cap04_feat001-passive-iron-income)
    - [Cap04_Feat002: Collectible Harvesting](#cap04_feat002-collectible-harvesting)
    - [Cap04_Feat003: Iron Capacity & Overflow](#cap04_feat003-iron-capacity--overflow)
  - [Cap05: Combat System](#cap05-combat-system)
    - [Cap05_Feat001: Battle Initiation & Level Matching](#cap05_feat001-battle-initiation--level-matching)
    - [Cap05_Feat002: Combat Rounds & Damage](#cap05_feat002-combat-rounds--damage)
    - [Cap05_Feat003: Battle Resolution & Rewards](#cap05_feat003-battle-resolution--rewards)
    - [Cap05_Feat004: Battle State & Immobilization](#cap05_feat004-battle-state--immobilization)
  - [Cap06: Research & Technology Tree](#cap06-research--technology-tree)
    - [Cap06_Feat001: Research Mechanics](#cap06_feat001-research-mechanics)
    - [Cap06_Feat002: Resource Sciences](#cap06_feat002-resource-sciences)
    - [Cap06_Feat003: Mobility Sciences](#cap06_feat003-mobility-sciences)
    - [Cap06_Feat004: Weapons Sciences](#cap06_feat004-weapons-sciences)
    - [Cap06_Feat005: Defense Sciences](#cap06_feat005-defense-sciences)
    - [Cap06_Feat006: Crew Sciences](#cap06_feat006-crew-sciences)
  - [Cap07: Factory & Manufacturing](#cap07-factory--manufacturing)
    - [Cap07_Feat001: Build Queue Management](#cap07_feat001-build-queue-management)
    - [Cap07_Feat002: Projectile Weapons](#cap07_feat002-projectile-weapons)
    - [Cap07_Feat003: Energy Weapons](#cap07_feat003-energy-weapons)
    - [Cap07_Feat004: Defense Systems](#cap07_feat004-defense-systems)
  - [Cap08: Inventory Management](#cap08-inventory-management)
    - [Cap08_Feat001: Item Inventory](#cap08_feat001-item-inventory)
    - [Cap08_Feat002: Bridge Crew](#cap08_feat002-bridge-crew)
  - [Cap09: Admin Tools](#cap09-admin-tools)
    - [Cap09_Feat001: Admin Authorization](#cap09_feat001-admin-authorization)
    - [Cap09_Feat002: Time Multiplier Management](#cap09_feat002-time-multiplier-management)
    - [Cap09_Feat003: Space Object Spawning](#cap09_feat003-space-object-spawning)
    - [Cap09_Feat004: Database & Statistics Inspection](#cap09_feat004-database--statistics-inspection)
  - [Cap10: Notifications](#cap10-notifications)
    - [Cap10_Feat001: Notification Sources](#cap10_feat001-notification-sources)
    - [Cap10_Feat002: Notification Display](#cap10_feat002-notification-display)
    - [Cap10_Feat003: Notification Management](#cap10_feat003-notification-management)
    - [Cap10_Feat004: Notification Summarization](#cap10_feat004-notification-summarization)
- [Document Format & Templates](#document-format--templates)

## Capabilities

_Capabilities are high-level functional areas that group related features. Each capability contains one or more features, which are cohesive groups of user-facing functionality._
_ Each feature contains individual requirements that describe specific behaviors or constraints._

### Cap01: Authentication & Session Management

**Purpose**: Players register, log in, and maintain secure sessions. Accounts are protected by bcrypt-hashed passwords and encrypted HTTP-only session cookies. Optional email verification and password-reset flows are available when the server is configured with an SMTP provider.

#### Contained Features

- [Cap01_Feat001](#cap01_feat001-account-registration): Account Registration
- [Cap01_Feat002](#cap01_feat002-login--session): Login & Session
- [Cap01_Feat003](#cap01_feat003-password-management): Password Management
- [Cap01_Feat004](#cap01_feat004-email-verification): Email Verification
- [Cap01_Feat005](#cap01_feat005-profile-customization): Profile Customization

---

#### Cap01_Feat001: Account Registration

Players create a new account with a unique username and password. A ship is provisioned automatically, and a welcome notification is sent. An optional email address enables verification and password-reset flows.

| ID                   | Requirement                                                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap01_Feat001_Req001 | Player can register a new account (`POST /api/register`) by providing a username and password. Both fields are required; missing fields are rejected with an error.                                                                                              |
| Cap01_Feat001_Req002 | An optional email address may be provided at registration. If provided, it must match the format `user@domain.tld` and must be unique; duplicate or malformed addresses are rejected with an error.                                                              |
| Cap01_Feat001_Req003 | On successful registration, a player ship is created at the default starting position and the player starts with default tech counts: 5× Pulse Laser, 5× Auto Turret, 5× Ship Hull, 5× Kinetic Armor, 5× Energy Shield.                                          |
| Cap01_Feat001_Req004 | On successful registration, a welcome notification is sent to the new player. See [Cap10: Notifications](#cap10-notifications).                                                                                                                                  |
| Cap01_Feat001_Req005 | A session cookie is created on successful registration, logging the player in immediately without a separate login step.                                                                                                                                         |
| Cap01_Feat001_Req006 | If an email address was provided and the server has email enabled, a verification email is sent with a 24-hour verification link. Registration always succeeds even if email delivery fails; the `emailSent` flag in the response indicates whether it was sent. |

---

#### Cap01_Feat002: Login & Session

Players log in with their username and password. Sessions are maintained via encrypted HTTP-only cookies with a 24-hour lifetime.

| ID                   | Requirement                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap01_Feat002_Req001 | Player can log in (`POST /api/login`) with a valid username and password. On success, an encrypted session cookie (`spacewars-session`) is set with a 24-hour lifetime.                                                                            |
| Cap01_Feat002_Req002 | Failed login attempts (wrong username or wrong password) return a generic "Invalid credentials" error; the response does not distinguish between the two failure modes to prevent username enumeration.                                            |
| Cap01_Feat002_Req003 | Player can check their current session state (`GET /api/session`). The response indicates whether the player is logged in, and if so, returns their username and ship ID.                                                                          |
| Cap01_Feat002_Req004 | Player can log out (`POST /api/logout`), which destroys the session cookie and ends the session immediately.                                                                                                                                       |
| Cap01_Feat002_Req005 | All protected pages and API routes redirect unauthenticated requests to the login page. The session is validated server-side on every protected request via the encrypted cookie.                                                                  |
| Cap01_Feat002_Req006 | Session cookies are HTTP-only (preventing JavaScript access) and are `secure` in production (HTTPS only). Session data is encrypted using a server-side secret of at least 32 characters configured via the `SESSION_SECRET` environment variable. |

---

#### Cap01_Feat003: Password Management

Logged-in players can change their password. Players who have registered with an email address can request a password reset by email if they forget their credentials.

| ID                   | Requirement                                                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap01_Feat003_Req001 | Authenticated player can change their password (`POST /api/change-password`) by providing their current password, a new password, and a confirmation of the new password. All three fields are required.                           |
| Cap01_Feat003_Req002 | Password change is rejected if the current password does not match the stored hash, or if the new password and confirmation do not match.                                                                                          |
| Cap01_Feat003_Req003 | Player can request a password reset email (`POST /api/forgot-password`) by providing their registered email address. The endpoint always returns success to prevent email enumeration, whether or not the address is on file.      |
| Cap01_Feat003_Req004 | When a password-reset email is sent, a single-use token with a 1-hour expiry is generated and stored. The email contains a link to the reset page (`/reset-password?token=…`).                                                     |
| Cap01_Feat003_Req005 | Player can set a new password via the reset link (`POST /api/reset-password`) by providing the token, a new password, and a confirmation. The token is consumed on use; expired or already-used tokens are rejected with an error. |

---

#### Cap01_Feat004: Email Verification

When a player registers with an email address and the server has email enabled, a verification flow confirms ownership of the address.

| ID                   | Requirement                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap01_Feat004_Req001 | When a player registers with an email address and the server has email enabled, a verification email is sent containing a link valid for 24 hours (`GET /api/verify-email?token=…`).  |
| Cap01_Feat004_Req002 | Clicking the verification link marks the account's email as verified. The token is single-use and expires after 24 hours; an expired or already-used token is rejected with an error. |
| Cap01_Feat004_Req003 | Accounts may be used normally regardless of email verification status; verification is optional and does not gate gameplay.                                                           |

---

#### Cap01_Feat005: Profile Customization

Players can personalize the visual appearance of their ship shown to other players in the game world and choose a preferred language for localized UI and notifications.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cap01_Feat005_Req001 | Authenticated player can update their ship's picture (`POST /api/update-ship-picture`) by providing a valid picture ID (integer in range 1–1000). Invalid values are rejected with an error.                                                                                                                                                                                                           |
| Cap01_Feat005_Req002 | The updated ship picture is immediately visible to all other players observing the game world (`GET /api/world`).                                                                                                                                                                                                                                                                                      |
| Cap01_Feat005_Req003 | Authenticated player can switch the game language between English and German from the Profile page language selector. The selection is applied immediately to localized UI and player-facing notifications, stored in the `NEXT_LOCALE` cookie, and persisted to the player's account when logged in (`POST /api/set-locale`; `ProfilePageClient.tsx`, `LocaleSwitcher.tsx`, `serverTranslations.ts`). |

---

### Cap02: Game Hub & Player Status

**Purpose**: The Home page is the player's central dashboard. It displays real-time progression stats, defense health, an active-battle banner, weapon and defense inventory counts, a leaderboard, and the notification feed.

#### Contained Features

- [Cap02_Feat001](#cap02_feat001-player-stats--progression): Player Stats & Progression
- [Cap02_Feat002](#cap02_feat002-defense-status-display): Defense Status Display
- [Cap02_Feat003](#cap02_feat003-tech-inventory-display): Tech Inventory Display
- [Cap02_Feat004](#cap02_feat004-leaderboard): Leaderboard
- [Cap02_Feat005](#cap02_feat005-battle-history): Battle History

---

#### Cap02_Feat001: Player Stats & Progression

The Home page displays key player stats: iron, level, XP, score, and all active game bonuses. Stats refresh automatically via polling.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cap02_Feat001_Req001 | Player can view their current iron amount, iron-per-second production rate, and iron storage capacity on the Home page. Iron display interpolates smoothly between server polls for visual consistency (`GET /api/user-stats`, polled every 5 seconds).                                                      |
| Cap02_Feat001_Req002 | Player can view their current level, total XP, and the XP threshold for the next level. Level is derived from total XP using a triangular-number formula: the XP required to reach level N is `(N-1)×N/2 × 1,000` cumulative XP.                                                                             |
| Cap02_Feat001_Req003 | Player can view their total score. Score is awarded by completing research and factory builds; see [Cap06: Research & Technology Tree](#cap06-research--technology-tree) and [Cap07: Factory & Manufacturing](#cap07-factory--manufacturing).                                                                |
| Cap02_Feat001_Req004 | Player can view their Level Bonus, displayed as a percentage. The level multiplier formula is `1.15^(level − 1)` and applies to iron production, iron capacity, weapon damage, and defense max values.                                                                                                       |
| Cap02_Feat001_Req005 | Player can view a summary of all active bonuses grouped by category: Iron Economy (iron rate, storage, max ship speed, current max ship speed), Defense Regen (repair rate, shield recharge rate), Projectile Weapons (damage, reload speed, accuracy), and Energy Weapons (damage, reload speed, accuracy). |
| Cap02_Feat001_Req006 | The Home page also displays the player's current teleport charge count and max charges when the Teleport research has been unlocked. See [Cap03_Feat004: Teleportation](#cap03_feat004-teleportation).                                                                                                       |
| Cap02_Feat001_Req007 | When the player is in an active battle, a battle-status banner is shown on the Home page, displaying the battle type (attacker or defender), the opponent, total damage dealt and received, and the remaining cooldown time for each weapon. See [Cap05: Combat System](#cap05-combat-system).               |

---

#### Cap02_Feat002: Defense Status Display

The Home page shows the current and maximum HP for each defense layer (hull, armor, shield) with color-coded health indicators. Values update in real time via client-side interpolation between server polls.

| ID                   | Requirement                                                                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap02_Feat002_Req001 | Player can view the current and maximum HP for Hull, Armor, and Shield on the Home page (`GET /api/ship-stats`, polled every 2 seconds). If no defense items have been built, an empty-state message is displayed instead.                                                                   |
| Cap02_Feat002_Req002 | Each defense value is color-coded by health percentage: red when below 50%, yellow when 50%–99%, and green when at 100% (full). Display values interpolate smoothly between server polls using the per-layer regen rate.                                                                     |
| Cap02_Feat002_Req003 | Maximum defense HP is calculated per layer as `baseValue × techCount × researchMultiplier × levelMultiplier`. All three layers are independent. See [Cap07_Feat004: Defense Systems](#cap07_feat004-defense-systems) and [Cap06_Feat005: Defense Sciences](#cap06_feat005-defense-sciences). |
| Cap02_Feat002_Req004 | Hull and Armor regenerate (via Repair Speed research) only outside of active combat. Shield regenerates continuously—both in and out of combat. See [Cap06_Feat005: Defense Sciences](#cap06_feat005-defense-sciences).                                                                      |

---

#### Cap02_Feat003: Tech Inventory Display

The Home page shows the player's current count of each weapon and defense item type, grouped by category.

| ID                   | Requirement                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap02_Feat003_Req001 | Player can view their current tech inventory on the Home page, grouped into Defense (Ship Hull, Kinetic Armor, Energy Shield, Missile Jammer) and Weapons (Pulse Laser, Auto Turret, Plasma Lance, Gauss Rifle, Photon Torpedo, Rocket Launcher). |
| Cap02_Feat003_Req002 | Tech counts are the source of truth for defense max HP and combat damage calculations. See [Cap07: Factory & Manufacturing](#cap07-factory--manufacturing).                                                                                       |

---

#### Cap02_Feat004: Leaderboard

Players can view a ranked leaderboard of all players sorted by score, along with category-specific best-in-game highlights.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cap02_Feat004_Req001 | Player can view a ranked leaderboard (`GET /api/leaderboard`) showing all players ordered by score (descending). Each entry shows rank, username, score, and a flag indicating whether it is the current player's entry.                                                                                                                                                                         |
| Cap02_Feat004_Req002 | The leaderboard also shows per-category best-in-game records, including: battles won, battles lost, total damage dealt, total damage received, total iron transferred in combat, total XP awarded, asteroids collected, shipwrecks collected, escape pods collected, total iron from collection, iron spent on research, iron spent on builds, total builds completed, and research completions. |
| Cap02_Feat004_Req003 | Additional per-category records cover tech levels: highest ship speed, hull strength, shield, armor, and individual weapon counts (Pulse Laser, Auto Turret, Plasma Lance, Gauss Rifle, Photon Torpedo, Rocket Launcher).                                                                                                                                                                        |

---

#### Cap02_Feat005: Battle History

Players can review a log of their completed battles, showing opponent names, outcomes, damage totals, and battle duration.

| ID                   | Requirement                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap02_Feat005_Req001 | Player can view a list of their completed battles (`GET /api/user-battles`). Each entry shows: opponent username, whether the player was the attacker, win/loss outcome, damage dealt, damage received, battle duration in seconds, and start and end timestamps. |
| Cap02_Feat005_Req002 | Only completed battles (those with a recorded end time) are returned. Ongoing battles are excluded from the history list.                                                                                                                                         |

---

### Cap03: Exploration & Navigation

**Purpose**: Players navigate a toroidal 2D world rendered on an HTML5 Canvas. Ships move continuously based on speed and angle; the world wraps seamlessly at its edges. Players control their course through click-to-navigate, direct parameter input, afterburner boosts, and teleportation.

#### Contained Features

- [Cap03_Feat001](#cap03_feat001-ship-navigation): Ship Navigation
- [Cap03_Feat002](#cap03_feat002-world--viewport): World & Viewport
- [Cap03_Feat003](#cap03_feat003-afterburner): Afterburner
- [Cap03_Feat004](#cap03_feat004-teleportation): Teleportation
- [Cap03_Feat005](#cap03_feat005-starbase-interaction): Starbase Interaction

---

#### Cap03_Feat001: Ship Navigation

Players set their ship's speed and heading to move through the world. A click-to-navigate interaction automatically calculates an interception course toward any target point or object.

| ID                   | Requirement                                                                                                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap03_Feat001_Req001 | Player can change their ship's speed and/or angle (`POST /api/navigate`) by providing a `speed` (0 to effective max speed) and/or an `angle` in degrees (0–360, automatically normalized). At least one parameter must be provided.                                                                 |
| Cap03_Feat001_Req002 | The ship moves continuously based on its current speed and angle. Position is updated using the formula `newPosition = oldPosition + (speed × elapsed × factor) / 60000`, where `factor = 50`. The time multiplier is applied to elapsed time.                                                      |
| Cap03_Feat001_Req003 | Navigation is disabled while the player is in an active battle. Attempting to navigate during combat returns an error. See [Cap05_Feat004: Battle State & Immobilization](#cap05_feat004-battle-state--immobilization).                                                                             |
| Cap03_Feat001_Req004 | Clicking on a game object or empty space in the canvas automatically calculates an interception course using a quadratic intercept algorithm that accounts for the target's current speed and direction, as well as toroidal world wrapping. The ship's angle is set accordingly.                   |
| Cap03_Feat001_Req005 | Clicking on a collectible object (asteroid, shipwreck, escape pod) within 125 world units of the ship triggers collection directly. Clicking on one that is farther away sets an interception course toward it. See [Cap04_Feat002: Collectible Harvesting](#cap04_feat002-collectible-harvesting). |
| Cap03_Feat001_Req006 | Max ship speed is controlled by the Ship Speed research level. See [Cap06_Feat003: Mobility Sciences](#cap06_feat003-mobility-sciences).                                                                                                                                                            |

---

#### Cap03_Feat002: World & Viewport

The game world is a toroidal 5000×5000-unit space rendered on an HTML5 Canvas. Players can zoom in and out; their ship is always centered on screen.

| ID                   | Requirement                                                                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---- | --- | --------- | --- | ---- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap03_Feat002_Req001 | The game world is 5000×5000 world units (configurable via the `WORLD_SIZE` environment variable). Objects that move past a boundary wrap seamlessly to the opposite edge: `position = ((position % size) + size) % size`.                 |
| Cap03_Feat002_Req002 | The canvas view is always centered on the player's ship. Other players' ships, collectible objects, and starbases are rendered relative to the player's position.                                                                         |
| Cap03_Feat002_Req003 | Player can zoom the viewport in and out. Zoom ranges from 0.25× (maximum zoom-out, showing more world) to 4.0× (maximum zoom-in). The default zoom level is 1.33×. Zoom preference is persisted in `localStorage`.                        |
| Cap03_Feat002_Req004 | The world state (`GET /api/world`) returns all space objects (player ships, asteroids, shipwrecks, escape pods, starbases) with their current positions, types, speeds, and angles. Other players' ships also include username and level. |
| Cap03_Feat002_Req005 | Toroidal distance between two objects is calculated as `sqrt(min(                                                                                                                                                                         | dx  | , W− | dx  | )² + min( | dy  | , H− | dy  | )²)` to correctly account for wrapping. This distance is used for range checks (collection, combat, starbase docking). See [Cap04_Feat002](#cap04_feat002-collectible-harvesting) and [Cap05_Feat001](#cap05_feat001-battle-initiation--level-matching). |

---

#### Cap03_Feat003: Afterburner

The Afterburner research (unlock gate, starts at level 0) grants a temporary speed boost fuelled by a rechargeable fuel tank.

| ID                   | Requirement                                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap03_Feat003_Req001 | Player can activate or deactivate the afterburner (`POST /api/afterburner` with `action: 'activate'` or `'deactivate'`). Activating requires the Afterburner Duration research to be at level ≥ 1. See [Cap06_Feat003: Mobility Sciences](#cap06_feat003-mobility-sciences).            |
| Cap03_Feat003_Req002 | While the afterburner is active, ship speed can exceed the normal max up to the boosted speed: `boostedSpeed = maxSpeed × (1 + afterburnerSpeedIncrease% / 100)`. When deactivated, speed is capped back to `maxSpeed`.                                                                 |
| Cap03_Feat003_Req003 | The afterburner uses a fuel tank with capacity set by the Afterburner Duration research level. Fuel drains linearly while the afterburner is active and recharges linearly while inactive (recharge time set by Afterburner Cooldown research). The time multiplier is applied to both. |
| Cap03_Feat003_Req004 | The afterburner can only be activated when fuel is at or above 33% capacity. Attempting to activate below this threshold returns an error.                                                                                                                                              |
| Cap03_Feat003_Req005 | The `GET /api/ship-stats` response includes the full afterburner status: active flag, remaining fuel (ms), fuel capacity (ms), fuel percentage, boosted speed, time until next activation, and whether the afterburner can currently be activated.                                      |

---

#### Cap03_Feat004: Teleportation

The Teleport research (unlock gate, starts at level 0) grants rechargeable teleport charges that allow instant positional jumps anywhere in the world.

| ID                   | Requirement                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap03_Feat004_Req001 | Player can teleport their ship to any valid coordinate within the world (`POST /api/teleport` with `x`, `y`, and optional `preserveVelocity`). Teleporting requires the Teleport research to be at level ≥ 1 and at least 1 full charge available. |
| Cap03_Feat004_Req002 | Teleportation cost scales with distance: `cost = min(1.0, distance / 2000)`. Traveling ≤ 2000 units costs a proportional fraction of a charge; traveling > 2000 units always costs exactly 1.0 charge.                                             |
| Cap03_Feat004_Req003 | Charges are stored as floating-point values. The player must have `floor(charges) ≥ 1` to teleport. The cost is deducted from `charges` after a successful teleport.                                                                               |
| Cap03_Feat004_Req004 | When `preserveVelocity` is false (the default), the ship arrives at the destination with speed = 0. When true, the ship retains its current speed and angle.                                                                                       |
| Cap03_Feat004_Req005 | Charges recharge over time at a rate controlled by the Teleport Recharge Speed research. The number of max charges is determined by the Teleport research level. See [Cap06_Feat003: Mobility Sciences](#cap06_feat003-mobility-sciences).         |
| Cap03_Feat004_Req006 | Teleportation is disabled while the player is in an active battle. Attempting to teleport during combat returns an error. See [Cap05_Feat004: Battle State & Immobilization](#cap05_feat004-battle-state--immobilization).                         |

---

#### Cap03_Feat005: Starbase Interaction

Starbases are stationary space stations. A player who docks within range can buy or sell Commanders via the Starbase shop.

| ID                   | Requirement                                                                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap03_Feat005_Req001 | Starbases are visible in the game world as large stationary objects. Clicking a starbase within 500 world units opens the starbase menu; clicking one that is farther away sets an interception course toward it.                                                                |
| Cap03_Feat005_Req002 | The starbase shop (`GET /api/starbase/shop`) offers 10 randomly generated Commander items for purchase. The shop stock is stored in the player's session; a new shop is generated on each visit.                                                                                 |
| Cap03_Feat005_Req003 | Player can buy a Commander from a shop slot (`POST /api/starbase/buy` with `slotIndex` 0–9), paying the listed iron price. The Commander is added to the first available inventory slot. If the player has insufficient iron or a full inventory, the purchase is rejected.      |
| Cap03_Feat005_Req004 | Player can sell a Commander from their inventory at the starbase (`POST /api/starbase/sell` with `row` and `col`). The Commander is removed from inventory and the sell price is added to the player's iron. Only Commander items can be sold; other item types return an error. |

---

### Cap04: Resource Gathering & Harvesting

**Purpose**: Iron is the primary currency, earned both passively over time and actively by collecting space objects. Passive income scales with research level and player level. Active collection requires navigating to collectible objects; escape pods yield Commanders instead of iron.

#### Contained Features

- [Cap04_Feat001](#cap04_feat001-passive-iron-income): Passive Iron Income
- [Cap04_Feat002](#cap04_feat002-collectible-harvesting): Collectible Harvesting
- [Cap04_Feat003](#cap04_feat003-iron-capacity--overflow): Iron Capacity & Overflow

---

#### Cap04_Feat001: Passive Iron Income

Iron accumulates automatically over time at a rate determined by the Iron Harvesting research level and the player's level multiplier.

| ID                   | Requirement                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap04_Feat001_Req001 | Iron accumulates passively at a rate of `IronHarvesting_Effect × levelMultiplier` iron per second. At research level 1 the base rate is 1.0 iron/sec; each additional level multiplies the rate by 1.1. The time multiplier is applied server-side when stats are updated.                        |
| Cap04_Feat001_Req002 | The Iron Harvesting research effect and the level multiplier (`1.15^(level − 1)`) together determine the displayed iron-per-second rate on the Home page. See [Cap06_Feat002: Resource Sciences](#cap06_feat002-resource-sciences) and [Cap02_Feat001](#cap02_feat001-player-stats--progression). |
| Cap04_Feat001_Req003 | If the Iron Harvesting research completes during a passive income update, iron is awarded at the old rate up to the research completion time and at the new (higher) rate for the remainder of the interval.                                                                                      |

---

#### Cap04_Feat002: Collectible Harvesting

Players actively collect asteroids, shipwrecks, and escape pods by moving to within 125 world units and triggering a harvest. Each object type yields a different reward, and collected objects are replaced immediately by a new randomly typed object.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cap04_Feat002_Req001 | Player can harvest a collectible space object (`POST /api/harvest` with `objectId`) when within 125 world units (toroidal distance). Requests for objects farther away are rejected with an error.                                                                                                                                                           |
| Cap04_Feat002_Req002 | **Asteroid**: Yields 50–700 iron (random, uniform distribution). Moves slowly (base speed 5 units/sec ±25%).                                                                                                                                                                                                                                                 |
| Cap04_Feat002_Req003 | **Shipwreck**: Yields 50–2,000 iron (random, uniform distribution). Moves at medium speed (base 10 units/sec ±25%).                                                                                                                                                                                                                                          |
| Cap04_Feat002_Req004 | **Escape Pod**: Yields 0 iron but adds a randomly generated Commander to the player's inventory. If the inventory is full the Commander is lost. Escape pods move fast (base 25 units/sec ±25%). See [Cap08_Feat001: Item Inventory](#cap08_feat001-item-inventory).                                                                                         |
| Cap04_Feat002_Req005 | After any collectible is harvested, a new object spawns immediately at a random world position with a random angle. The new object type is drawn with probabilities: 60% asteroid, 30% shipwreck, 10% escape pod.                                                                                                                                            |
| Cap04_Feat002_Req006 | A notification is sent to the player on each successful harvest, stating the object type and iron received. Escape pod notifications name the rescued Commander and list the stat bonuses awarded; if the inventory was full the notification states the Commander was lost. See [Cap10_Feat001: Notification Sources](#cap10_feat001-notification-sources). |

---

#### Cap04_Feat003: Iron Capacity & Overflow

Iron storage is capped by the Iron Capacity research level and the player's level multiplier. Iron above the cap is silently discarded.

| ID                   | Requirement                                                                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap04_Feat003_Req001 | The player's maximum iron storage is `IronCapacity_Effect × levelMultiplier`. At research level 1 the base capacity is 5,000 iron; each additional level doubles the capacity. See [Cap06_Feat002: Resource Sciences](#cap06_feat002-resource-sciences). |
| Cap04_Feat003_Req002 | When iron is added (passive income, collection, or combat reward) and the result would exceed the capacity cap, only the iron that fits is added; the excess is discarded silently.                                                                      |
| Cap04_Feat003_Req003 | The iron reward shown in collection and combat responses reflects the amount actually added (after capacity enforcement), not the raw reward value.                                                                                                      |

---

### Cap05: Combat System

**Purpose**: Players attack other players within range and level restrictions. Combat proceeds automatically in timed rounds; each round fires all ready weapons and applies damage to the opponent's defense layers. The battle ends when one player's hull reaches zero; the winner receives iron and XP, and the loser is teleported away.

#### Contained Features

- [Cap05_Feat001](#cap05_feat001-battle-initiation--level-matching): Battle Initiation & Level Matching
- [Cap05_Feat002](#cap05_feat002-combat-rounds--damage): Combat Rounds & Damage
- [Cap05_Feat003](#cap05_feat003-battle-resolution--rewards): Battle Resolution & Rewards
- [Cap05_Feat004](#cap05_feat004-battle-state--immobilization): Battle State & Immobilization

---

#### Cap05_Feat001: Battle Initiation & Level Matching

A player initiates combat by targeting another player's ship. Several conditions must be met: proximity, level parity, and neither player already being in a battle.

| ID                   | Requirement                                                                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap05_Feat001_Req001 | Player can initiate a battle against another player (`POST /api/attack` with `targetUserId`). On the canvas, enemy ships are highlighted by color to indicate whether they are attackable based on level difference.                                  |
| Cap05_Feat001_Req002 | Attack is only allowed when the level difference between attacker and target is ≤ 3. Ships outside this range are shown in gray on the canvas (not attackable). Ships within the range are color-coded from green (easy target) to red (hard target). |
| Cap05_Feat001_Req003 | Attack is only allowed when both players are within 100 world units (toroidal distance) of each other.                                                                                                                                                |
| Cap05_Feat001_Req004 | Attack is rejected if either player is already in an active battle.                                                                                                                                                                                   |
| Cap05_Feat001_Req005 | Attack is rejected if the attacker has no weapons.                                                                                                                                                                                                    |
| Cap05_Feat001_Req006 | Attack is rejected if the attacker has targeted the same player as one of their last 3 opponents (prevents repeated farming of the same target).                                                                                                      |

---

#### Cap05_Feat002: Combat Rounds & Damage

After a battle starts, combat is processed automatically every second. All weapons that have completed their cooldown fire simultaneously; damage is applied to the defender's layered defenses.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap05_Feat002_Req001 | Each battle is processed every 1 second by an automated scheduler. In each processing step, all weapons on both sides whose cooldown has expired fire simultaneously.                                                                                                                                                                                                        |
| Cap05_Feat002_Req002 | Weapon cooldowns are measured from the time the weapon last fired. Effective cooldown = `baseCooldown ÷ reloadFactor`. The time multiplier is applied: `ceil(effectiveCooldown ÷ timeMultiplier)`. The `reloadFactor` incorporates research, level, and bridge crew bonus multipliers; see [Cap05_Feat002_Req008](#cap05_feat002-combat-rounds--damage) for how these stack. |
| Cap05_Feat002_Req003 | Damage flows through three defense layers in order: Shield → Armor → Hull. Shield absorbs energy weapon damage at 50% effectiveness and projectile weapon damage at full effectiveness. Armor absorbs projectile weapon damage at 50% effectiveness and energy weapon damage at full effectiveness. Hull absorbs all remaining damage.                                       |
| Cap05_Feat002_Req004 | Projectile weapons (Gauss Rifle) partially bypass the Shield layer based on the Projectile Weapon Tier research: `bypass fraction = 1 − 0.95^researchLevel`. Bypassed damage is applied directly to the Armor layer. See [Cap06_Feat004: Weapons Sciences](#cap06_feat004-weapons-sciences).                                                                                 |
| Cap05_Feat002_Req005 | Energy weapons (Plasma Lance) partially bypass the Armor layer when the Energy Accuracy research multiplier exceeds 1.0: `bypass fraction = max(0, 1 − 1/accuracyMultiplier)`. Bypassed damage is applied directly to the Hull layer. See [Cap06_Feat004: Weapons Sciences](#cap06_feat004-weapons-sciences).                                                                |
| Cap05_Feat002_Req006 | Guided weapons (Rocket Launcher, Photon Torpedo) are affected by the defender's Missile Jammer count. Each jammer reduces effective accuracy: `accuracy = base × accMult × (1 − ecmEffectiveness)`. Photon Torpedos receive only one-third of the ECM penalty. See [Cap07_Feat004: Defense Systems](#cap07_feat004-defense-systems).                                         |
| Cap05_Feat002_Req007 | After each weapon fires, a notification is sent to both the attacker and the defender listing the weapon, shots fired, shots that hit, and total damage dealt. A separate notification is sent if all shots miss. See [Cap10_Feat001: Notification Sources](#cap10_feat001-notification-sources).                                                                            |
| Cap05_Feat002_Req008 | Damage multipliers from research, level, and bridge crew stack multiplicatively. The combined multiplier is applied to raw weapon damage before layer processing. See [Cap08_Feat002: Bridge Crew](#cap08_feat002-bridge-crew).                                                                                                                                              |

---

#### Cap05_Feat003: Battle Resolution & Rewards

The battle ends when a player's hull HP reaches zero. The winner receives iron and XP; the loser is teleported to a random distant position.

| ID                   | Requirement                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Cap05_Feat003_Req001 | The battle ends when either player's Hull HP reaches 0 or below. The player with remaining hull HP > 0 is the winner.                                                                                   |
| Cap05_Feat003_Req002 | On victory, the winner receives iron transferred from the loser: up to `min(loser.iron, winner.remaining_iron_capacity)`. The loser's iron is reduced by the same amount.                               |
| Cap05_Feat003_Req003 | On victory, the winner receives XP. Base XP = `winnerLevel × 200`. If the loser was a higher level, XP is multiplied by `1.3^levelDifference`; if lower level, XP is multiplied by `0.7^                | levelDifference | `. Completing a level-up triggers a level-up notification. See [Cap10_Feat001](#cap10_feat001-notification-sources). |
| Cap05_Feat003_Req004 | The loser is teleported to a random position at least 1,000 world units from the winner's current position. The loser's ship speed is set to 0 on arrival.                                              |
| Cap05_Feat003_Req005 | Victory and defeat notifications are sent to both players stating iron gained/lost, XP gained, and the opponent's name. See [Cap10_Feat001: Notification Sources](#cap10_feat001-notification-sources). |

---

#### Cap05_Feat004: Battle State & Immobilization

While a battle is active, both players are immobilized and restricted from performing most other game actions.

| ID                   | Requirement                                                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap05_Feat004_Req001 | At battle start, both players' ship speed is set to 0. Ships cannot move (navigate), teleport, or harvest collectibles while in battle.                                                                                             |
| Cap05_Feat004_Req002 | The current battle state is available via `GET /api/battle-status`. When in battle it returns: battle ID, attacker/defender flag, opponent ID, cumulative damage totals, weapon cooldown timestamps, and the full battle event log. |
| Cap05_Feat004_Req003 | When not in a battle, `GET /api/battle-status` returns `{ inBattle: false }`.                                                                                                                                                       |
| Cap05_Feat004_Req004 | Hull and Armor do not regenerate during active combat. Shield regeneration continues during combat. See [Cap06_Feat005: Defense Sciences](#cap06_feat005-defense-sciences).                                                         |

### Cap06: Research & Technology Tree

**Purpose**: Players invest iron to research and upgrade technologies, unlocking new capabilities and enhancing ship performance across all gameplay areas.

#### Contained Features

- [Cap06_Feat001](#cap06_feat001-research-mechanics): Research Mechanics
- [Cap06_Feat002](#cap06_feat002-resource-sciences): Resource Sciences
- [Cap06_Feat003](#cap06_feat003-mobility-sciences): Mobility Sciences
- [Cap06_Feat004](#cap06_feat004-weapons-sciences): Weapons Sciences
- [Cap06_Feat005](#cap06_feat005-defense-sciences): Defense Sciences
- [Cap06_Feat006](#cap06_feat006-crew-sciences): Crew Sciences

---

#### Cap06_Feat001: Research Mechanics

Players trigger and monitor research progress via the Research page. Only one research can be active at a time; iron is spent immediately upon start.

| ID                   | Requirement                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap06_Feat001_Req001 | Player can view all available research technologies on the Research page, organized by category: Resource Sciences, Mobility Sciences, Weapons Sciences, Defense Sciences, and Crew Sciences (`GET /api/techtree`). |
| Cap06_Feat001_Req002 | Each technology card displays: current level, next-level iron cost, research duration, and the effect at both the current and next level.                                                                           |
| Cap06_Feat001_Req003 | Player can trigger a research upgrade (`POST /api/trigger-research`). Iron is deducted immediately upon trigger. If the player has insufficient iron, the request is rejected.                                      |
| Cap06_Feat001_Req004 | Only one research may be active at a time. Attempting to start a second while one is active is rejected with an error. All other technology cards are disabled while a research is in progress.                     |
| Cap06_Feat001_Req005 | The active research card displays a live countdown timer. When the countdown reaches zero, the research level increments by 1 and the slot becomes available for the next research.                                 |
| Cap06_Feat001_Req006 | Research costs scale exponentially per level. Each technology defines its own base cost and cost-increase factor applied per level upgrade.                                                                         |
| Cap06_Feat001_Req007 | Player can preview the next 20 levels of any technology via an info tooltip, showing the iron cost and effect value at each future level.                                                                           |
| Cap06_Feat001_Req008 | Technologies starting at level 0 are "unlock gates": they must be researched to level 1 to activate the gated feature. Technologies starting at level 1 are already active at game start.                           |
| Cap06_Feat001_Req009 | Completing a research awards XP equal to the iron cost of that upgrade divided by 25. A level-up notification is sent if a new player level is reached. See [Cap10: Notifications](#cap10-notifications).           |

---

#### Cap06_Feat002: Resource Sciences

Research technologies that increase iron income, storage capacity, and construction speed.

| ID                   | Requirement                                                                                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap06_Feat002_Req001 | **Iron Harvesting**: Increases passive iron income per second. Starts at level 1 (1.0 iron/sec). Each additional level multiplies the harvest rate by 1.1 (exponential growth). Base upgrade cost: 100 iron; cost doubles per level.                                                            |
| Cap06_Feat002_Req002 | **Iron Capacity**: Increases maximum iron storage. Starts at level 1 (5,000 iron). Each additional level doubles capacity. Base upgrade cost: 800 iron; cost scales by factor 1.7 per level.                                                                                                    |
| Cap06_Feat002_Req003 | **Construction Speed**: Reduces build time for factory items. Starts at level 1 (10% faster). Higher levels add progressively more reduction via polynomial growth. Base upgrade cost: 1,400 iron; cost doubles per level. See [Cap07: Factory & Manufacturing](#cap07-factory--manufacturing). |

---

#### Cap06_Feat003: Mobility Sciences

Research technologies that govern ship speed, afterburner activation, and teleportation.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap06_Feat003_Req001 | **Ship Speed**: Increases base ship travel speed. Starts at level 1 (25 speed units). Each additional level adds 5 units linearly. Base upgrade cost: 500 iron; cost doubles per level.                                                                                                                                               |
| Cap06_Feat003_Req002 | **Afterburner Duration** (unlock gate, starts at level 0): Level 1 unlocks the afterburner and sets full-fuel burn duration to 30 seconds. Each additional level adds 10 seconds. The afterburner can only be activated when fuel is at ≥ 33%. Base upgrade cost: 2,000 iron; cost scales by factor 1.9 per level.                    |
| Cap06_Feat003_Req003 | **Afterburner Cooldown**: Reduces afterburner fuel recharge time. Starts at level 1 (3,600 seconds). Each additional level multiplies recharge time by 0.9 (exponential decay). Base upgrade cost: 2,000 iron; cost doubles per level.                                                                                                |
| Cap06_Feat003_Req004 | **Afterburner Speed**: Increases the speed bonus while the afterburner is active. Starts at level 1 (+50%). Each additional level adds 25 percentage-points linearly. Base upgrade cost: 2,000 iron; cost doubles per level.                                                                                                          |
| Cap06_Feat003_Req005 | **Teleport** (unlock gate, starts at level 0): Level 1 unlocks teleportation and grants 1 charge. Each additional level grants +1 charge. Charge consumption scales with travel distance. Base upgrade cost: 10,000 iron; cost scales by factor 1.3 per level. See [Cap03: Exploration & Navigation](#cap03-exploration--navigation). |
| Cap06_Feat003_Req006 | **Teleport Recharge Speed**: Reduces the time for a teleport charge to replenish. Starts at level 1 (86,400 seconds per charge). Each additional level multiplies recharge time by 0.9 (exponential decay). Base upgrade cost: 10,000 iron; cost scales by factor 1.3 per level.                                                      |

---

#### Cap06_Feat004: Weapons Sciences

Research technologies that improve damage output, accuracy, reload speed, and unlock higher weapon tiers for both projectile and energy weapons.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap06_Feat004_Req001 | **Projectile Damage**: Increases the damage multiplier for all equipped projectile weapons. Starts at level 1 (50 base damage). Each additional level multiplies the effect by 1.15. Base upgrade cost: 1,000 iron; cost doubles per level.                                                                                                     |
| Cap06_Feat004_Req002 | **Projectile Reload Rate**: Reduces reload time for projectile weapons. Starts at level 1 (10% faster). Each additional level adds 10 percentage-points linearly. Base upgrade cost: 800 iron; cost scales by factor 1.8 per level.                                                                                                             |
| Cap06_Feat004_Req003 | **Projectile Accuracy**: Improves the hit probability of projectile weapons via polynomial growth. Starts at level 1 (70% base accuracy). Base upgrade cost: 1,200 iron; cost scales by factor 1.9 per level.                                                                                                                                   |
| Cap06_Feat004_Req004 | **Projectile Weapon Tier** (unlock gate, starts at level 0): Unlocks and upgrades higher-tier projectile weapons (e.g., Gauss Rifle). Each tier level increases shield bypass: `1 − 0.95^level`. Base upgrade cost: 5,000 iron; cost scales by factor 2.5 per level. See [Cap07: Factory & Manufacturing](#cap07-factory--manufacturing).       |
| Cap06_Feat004_Req005 | **Energy Damage**: Increases the damage multiplier for all equipped energy weapons. Starts at level 1 (60 base damage). Each additional level multiplies the effect by 1.15. Base upgrade cost: 1,100 iron; cost doubles per level.                                                                                                             |
| Cap06_Feat004_Req006 | **Energy Recharge Rate**: Reduces recharge time for energy weapons between shots. Starts at level 1 (15% faster). Each additional level adds 15 percentage-points linearly. Base upgrade cost: 900 iron; cost scales by factor 1.8 per level.                                                                                                   |
| Cap06_Feat004_Req007 | **Energy Accuracy**: Improves the hit probability of energy weapons via polynomial growth. Starts at level 1 (65% base accuracy). High accuracy multipliers also grant armor bypass for applicable energy weapons (e.g., Plasma Lance): `max(0, 1 − 1/accuracyMultiplier)`. Base upgrade cost: 1,300 iron; cost scales by factor 1.9 per level. |
| Cap06_Feat004_Req008 | **Energy Weapon Tier** (unlock gate, starts at level 0): Unlocks and upgrades higher-tier energy weapons (e.g., Plasma Lance). Each tier level progressively increases armor bypass. Base upgrade cost: 5,500 iron; cost scales by factor 2.5 per level. See [Cap07: Factory & Manufacturing](#cap07-factory--manufacturing).                   |

---

#### Cap06_Feat005: Defense Sciences

Research technologies that improve the strength and recovery rates of hull, armor, and shield defense layers.

| ID                   | Requirement                                                                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap06_Feat005_Req001 | **Hull Strength**: Increases max hull HP per installed hull plate via polynomial growth. Starts at level 1 (100 base HP per plate). Base upgrade cost: 1,500 iron; cost scales by factor 2.2 per level.                                                                          |
| Cap06_Feat005_Req002 | **Repair Speed**: Increases passive HP-per-second repair rate for hull, armor, and engine. Repair does not apply during active combat. Starts at level 1 (0.1 HP/sec). Each additional level multiplies the rate by 1.15. Base upgrade cost: 1,000 iron; cost doubles per level. |
| Cap06_Feat005_Req003 | **Armor Effectiveness**: Increases max armor HP per installed armor plate via polynomial growth. Starts at level 1 (100 base HP per plate). Base upgrade cost: 1,800 iron; cost scales by factor 2.1 per level.                                                                  |
| Cap06_Feat005_Req004 | **Shield Effectiveness**: Increases max shield HP per installed shield unit via polynomial growth. Starts at level 1 (100 base HP per unit). Base upgrade cost: 1,600 iron; cost scales by factor 2.1 per level.                                                                 |
| Cap06_Feat005_Req005 | **Shield Recharge Rate**: Increases HP-per-second shield recovery. Shield recharge applies both passively and during active combat. Starts at level 1 (0.1 HP/sec). Each additional level multiplies the rate by 1.13. Base upgrade cost: 1,000 iron; cost doubles per level.    |

---

#### Cap06_Feat006: Crew Sciences

Research technologies that govern inventory capacity and bridge crew slots.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap06_Feat006_Req001 | **Inventory Slots**: Increases the number of available inventory slots. Starts at level 1 (16 slots). Each additional level adds 8 slots linearly. Base upgrade cost: 5,000 iron; cost scales by factor 1.8 per level. See [Cap08_Feat001: Item Inventory](#cap08_feat001-item-inventory).                                            |
| Cap06_Feat006_Req002 | **Bridge Slots** (unlock gate, starts at level 0): Level 1 unlocks bridge crew assignment with 4 bridge slots. Each additional level adds 4 more slots. Default is 0 bridge slots until researched. Base upgrade cost: 5,000 iron; cost scales by factor 1.8 per level. See [Cap08_Feat002: Bridge Crew](#cap08_feat002-bridge-crew). |

### Cap07: Factory & Manufacturing

**Purpose**: Players manufacture weapons and defensive systems over time using iron currency. Items are built sequentially in a persistent queue; research technologies unlock higher-tier weapons and reduce build times.

#### Contained Features

- [Cap07_Feat001](#cap07_feat001-build-queue-management): Build Queue Management
- [Cap07_Feat002](#cap07_feat002-projectile-weapons): Projectile Weapons
- [Cap07_Feat003](#cap07_feat003-energy-weapons): Energy Weapons
- [Cap07_Feat004](#cap07_feat004-defense-systems): Defense Systems

---

#### Cap07_Feat001: Build Queue Management

Players queue items for manufacturing and monitor build progress. Iron is deducted at queue start; items build sequentially until the queue empties or iron is depleted.

| ID                   | Requirement                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap07_Feat001_Req001 | Player can view all available weapons and defense systems via the Factory page (`GET /api/tech-catalog`), displaying specs: name, cost, build time, base stats, and any research requirements.                                |
| Cap07_Feat001_Req002 | Player can queue one or more items for building (`POST /api/build-item`). If the queue is empty, iron is deducted immediately for the first item. If the queue has items, iron is deferred until that item becomes buildable. |
| Cap07_Feat001_Req003 | Player can retrieve the current build status and queue via (`GET /api/build-status`), which also processes any completed builds, increments tech counts, and awards score.                                                    |
| Cap07_Feat001_Req004 | Items build sequentially; only one item builds at a time. The second queued item does NOT start building until the first completes.                                                                                           |
| Cap07_Feat001_Req005 | Build times are displayed in the queue as countdown timers. When a build completes, the next item (if any) begins immediately.                                                                                                |
| Cap07_Feat001_Req006 | Build times scale with the time multiplier, which may be adjusted by administrators. Effective build time = base build time ÷ time multiplier.                                                                                |
| Cap07_Feat001_Req007 | The Research technology [Construction Speed](#cap06_feat002-resource-sciences) reduces build times via polynomial growth. Research multiplier is applied: effective build time = base build time ÷ time multiplier.           |
| Cap07_Feat001_Req008 | If iron is insufficient when an item should begin building, the entire remaining queue is aborted (cleared). A notification is sent stating the aborted item name and count of removed items.                                 |
| Cap07_Feat001_Req009 | Completing a build awards score (not XP) equal to 1% of the item's iron cost: `⌊baseCost ÷ 100⌋`.                                                                                                                             |
| Cap07_Feat001_Req010 | Player starts the game with default quantities of basic weapons and defense items: 5× Pulse Laser, 5× Auto Turret, 5× Ship Hull, 5× Kinetic Armor, 5× Energy Shield. All higher-tier weapons start at 0.                      |

---

#### Cap07_Feat002: Projectile Weapons

Projectile weapons are specialized for armor penetration. Two are always available; two unlock via research tiers.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap07_Feat002_Req001 | **Auto Turret** (weak, always available): Cost 100 iron; build time 1 minute; base damage 10; accuracy 50%; reload 12 minutes. Deals 80% to shields, 20% to armor. Advantage: cheap, fast reload. Disadvantage: reduced vs. armor.                                                                                                                                                                                                       |
| Cap07_Feat002_Req002 | **Gauss Rifle** (medium, ProjectileWeaponTier ≥ 1): Cost 500 iron; build time 5 minutes; base damage 40; accuracy 70%; reload 15 minutes. Deals 10% to shields, 90% to armor. Shield penetration scales with tier: `1 − 0.95^level`. At tier 10: ~40% shield bypass. Advantage: penetrates shields. Disadvantage: reduced vs. armor. See [Cap06_Feat004: Projectile Weapon Tier](#cap06_feat004-weapons-sciences).                       |
| Cap07_Feat002_Req003 | **Rocket Launcher** (strong, ProjectileWeaponTier ≥ 1): Cost 3,500 iron; build time 20 minutes; base damage 200; accuracy 100% (always hits if target exists); reload 20 minutes. Deals 40% to shields, 60% to armor. Guided; not affected by enemy dodge/movement. Vuln. to [Missile Jammer](#cap07_feat004-defense-systems). Advantage: guaranteed hit (guided); high damage. Disadvantage: expensive; requires jammer countermeasure. |
| Cap07_Feat002_Req004 | Research [Projectile Damage](#cap06_feat004-weapons-sciences) multiplies the base damage of all equipped projectile weapons by the research effect. Each projectile weapon applies the multiplier independently in combat.                                                                                                                                                                                                               |
| Cap07_Feat002_Req005 | Research [Projectile Reload Rate](#cap06_feat004-weapons-sciences) reduces reload time for all projectile weapons. Reload time = base cooldown ÷ (1 + reloadRate/100).                                                                                                                                                                                                                                                                   |
| Cap07_Feat002_Req006 | Research [Projectile Accuracy](#cap06_feat004-weapons-sciences) improves hit probability with polynomial growth. Accuracy multiplier = effect ÷ base_effect.                                                                                                                                                                                                                                                                             |

---

#### Cap07_Feat003: Energy Weapons

Energy weapons are specialized for shield penetration. Two are always available; two unlock via research tiers.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap07_Feat003_Req001 | **Pulse Laser** (weak, always available): Cost 150 iron; build time 2 minutes; base damage 7; accuracy 80%; reload 12 minutes. Deals 90% to shields, 10% to armor. Advantage: high accuracy; effective vs. shields. Disadvantage: reduced vs. armor; low base damage.                                                                                                                                                                                                                                         |
| Cap07_Feat003_Req002 | **Plasma Lance** (medium, EnergyWeaponTier ≥ 1): Cost 500 iron; build time 5 minutes; base damage 30; accuracy 90%; reload 15 minutes. Deals 70% to shields, 30% to armor. Armor bypass occurs when accuracy multiplier > 1.0, calculated as: `max(0, 1 − 1/accuracyMultiplier)`. At 200% accuracy: 50% bypass; at 300% accuracy: ~67% bypass. Advantage: high accuracy; bypasses armor if boosted. Disadvantage: reduced vs. shields. See [Cap06_Feat004: Energy Accuracy](#cap06_feat004-weapons-sciences). |
| Cap07_Feat003_Req003 | **Photon Torpedo** (strong, EnergyWeaponTier ≥ 1): Cost 2,000 iron; build time 10 minutes; base damage 200; accuracy 75%; reload 20 minutes. Deals 90% to shields, 10% to armor. Vulnerable to [Missile Jammer](#cap07_feat004-defense-systems). Advantage: heavy damage. Disadvantage: expensive; jammer vulnerable.                                                                                                                                                                                         |
| Cap07_Feat003_Req004 | Research [Energy Damage](#cap06_feat004-weapons-sciences) multiplies the base damage of all equipped energy weapons by the research effect. Each energy weapon applies the multiplier independently in combat.                                                                                                                                                                                                                                                                                                |
| Cap07_Feat003_Req005 | Research [Energy Recharge Rate](#cap06_feat004-weapons-sciences) reduces reload time for all energy weapons. Reload time = base cooldown ÷ (1 + rechargeRate/100).                                                                                                                                                                                                                                                                                                                                            |
| Cap07_Feat003_Req006 | Research [Energy Accuracy](#cap06_feat004-weapons-sciences) improves hit probability and armor bypass with polynomial growth. Armor bypass is calculated from the accuracy multiplier.                                                                                                                                                                                                                                                                                                                        |

---

#### Cap07_Feat004: Defense Systems

Players build defense layers (hull, armor, shield) and a specialized ECM jammer. All defense items are always available.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap07_Feat004_Req001 | **Ship Hull** (structural defense): Cost 150 iron; build time 2 minutes; base HP 150 per unit. Increases max hull strength through research [Hull Strength](#cap06_feat005-defense-sciences) via polynomial growth. Advantage: foundational layer; protects entire ship. Disadvantage: most vulnerable layer.                                                                                                                                                                                                                                                 |
| Cap07_Feat004_Req002 | **Kinetic Armor** (projectile resistance): Cost 200 iron; build time 2 minutes; base HP 250 per unit. Reduces projectile damage to 50% effectiveness (projectiles deal reduced damage to armor layer). Increases max armor strength through research [Armor Effectiveness](#cap06_feat005-defense-sciences) via polynomial growth. Advantage: effective vs. projectiles. Disadvantage: reduced effectiveness vs. energy.                                                                                                                                      |
| Cap07_Feat004_Req003 | **Energy Shield** (energy resistance): Cost 200 iron; build time 2 minutes; base HP 250 per unit. Reduces energy weapons to 50% effectiveness (energy deals reduced damage to shield layer). Regenerates at rate controlled by research [Shield Recharge Rate](#cap06_feat005-defense-sciences); regeneration applies both passively and during combat. Increases max shield strength through research [Shield Effectiveness](#cap06_feat005-defense-sciences) via polynomial growth. Advantage: effective vs. energy. Disadvantage: reduced vs. projectiles. |
| Cap07_Feat004_Req004 | **Missile Jammer** (ECM countermeasure): Cost 350 iron; build time 5 minutes; base effect 1 jammer per unit (special, not HP-based). Intercepts guided weapons (Rocket Launcher, Photon Torpedo, Guided Missiles). Locks onto guided projectiles and prevents them from hitting. Disadvantage: does not affect ballistic weapons (Auto Turret, Pulse Laser, Gauss Rifle, Plasma Lance).                                                                                                                                                                       |
| Cap07_Feat004_Req005 | Defense values are calculated per unit: `max_defense = baseValue × techCount × researchMultiplier × levelMultiplier`. All three defense layers (hull, armor, shield) are independent and stack additively in shield/armor damage calculation.                                                                                                                                                                                                                                                                                                                 |
| Cap07_Feat004_Req006 | Research [Repair Speed](#cap06_feat005-defense-sciences) increases passive repair rate (hull, armor, engine). Repair does not apply during active combat.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Cap07_Feat004_Req007 | The defense layer hierarchy: Shield absorbs energy damage (reduced by 50%); Armor absorbs projectile damage (reduced by 50%); Hull absorbs all remaining damage. Damage that penetrates a layer due to research effects (shield bypass, armor bypass) flows to the next layer.                                                                                                                                                                                                                                                                                |

### Cap08: Inventory Management

Manage items in the ship's inventory; assign compatible items to bridge slots to activate their stat bonuses and enhance ship capabilities. Currently, commanders are the only item type in inventory.

#### Contained Features

- [Cap08_Feat001](#cap08_feat001-item-inventory): Item Inventory
- [Cap08_Feat002](#cap08_feat002-bridge-crew): Bridge Crew

---

#### Cap08_Feat001: Item Inventory

Players manage a grid-based inventory of items. Items can be inspected, reordered, sorted, and deleted. Selling items for iron is done at the Starbase; see [Cap03: Exploration & Navigation](#cap03-exploration--navigation).

| ID                   | Requirement                                                                                                                                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap08_Feat001_Req001 | Player can view their inventory as a grid (rows × 8 columns). Each occupied slot shows the item's portrait and brief stat summary.                                                                                                                                                                          |
| Cap08_Feat001_Req002 | Player can select any occupied slot to view full item details: name, portrait, and all stat bonuses with their values.                                                                                                                                                                                      |
| Cap08_Feat001_Req003 | The maximum number of inventory slots is determined by the InventorySlots research level. See [Cap06: Research & Technology Tree](#cap06-research--technology-tree).                                                                                                                                        |
| Cap08_Feat001_Req004 | Player can move an item to a different slot within the inventory grid (`POST /api/inventory/move`).                                                                                                                                                                                                         |
| Cap08_Feat001_Req005 | Player can sort the inventory by a chosen stat key or by total bonus value, in ascending or descending order. Empty slots are pushed to the end of the grid.                                                                                                                                                |
| Cap08_Feat001_Req006 | Player can permanently delete an item from inventory (`DELETE /api/inventory`). Deletion requires no confirmation and awards no iron. To sell an item for iron, the player must visit the Starbase. See [Cap03: Exploration & Navigation](#cap03-exploration--navigation).                                  |
| Cap08_Feat001_Req007 | Commander items display a name (three-part: first, middle initial, last) and a portrait image. Portrait gender is derived from the imageId.                                                                                                                                                                 |
| Cap08_Feat001_Req008 | Commander items carry 1–3 stat bonuses. Each bonus targets one of seven stats: `shipSpeed`, `projectileWeaponDamage`, `projectileWeaponReloadRate`, `projectileWeaponAccuracy`, `energyWeaponDamage`, `energyWeaponReloadRate`, `energyWeaponAccuracy`. Bonus values range from 0.1 to 1.0 in steps of 0.1. |

---

#### Cap08_Feat002: Bridge Crew

Players assign inventory items to bridge slots to activate their stat bonuses. Bonuses from all assigned items stack multiplicatively and combine with the player's level and research multipliers.

| ID                   | Requirement                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap08_Feat002_Req001 | Player can view their bridge crew grid and see which slots are occupied and which are empty.                                                                                                                                             |
| Cap08_Feat002_Req002 | The maximum number of bridge slots is determined by the BridgeSlots research level. Default is 0 (no bridge capacity until researched). See [Cap06: Research & Technology Tree](#cap06-research--technology-tree).                       |
| Cap08_Feat002_Req003 | Player can assign an item from inventory to a specific empty bridge slot (`POST /api/bridge/transfer`, direction `inventoryToBridge`). The item is removed from inventory and placed in the bridge slot.                                 |
| Cap08_Feat002_Req004 | Player can auto-assign an item from inventory to the first available bridge slot (`POST /api/bridge/transfer/auto`).                                                                                                                     |
| Cap08_Feat002_Req005 | Player can remove an item from a bridge slot; the item is returned to inventory (`POST /api/bridge/transfer`, direction `bridgeToInventory`).                                                                                            |
| Cap08_Feat002_Req006 | Player can reorder items within the bridge grid by swapping two bridge slots (`POST /api/bridge/move`).                                                                                                                                  |
| Cap08_Feat002_Req007 | Stat bonuses from all bridge crew items stack multiplicatively across all assigned items. The combined bonus is further multiplied by the player's level multiplier and applicable research multipliers.                                 |
| Cap08_Feat002_Req008 | Bridge crew bonuses affect the following ship and combat stats: `shipSpeed`, `projectileWeaponDamage`, `projectileWeaponReloadRate`, `projectileWeaponAccuracy`, `energyWeaponDamage`, `energyWeaponReloadRate`, `energyWeaponAccuracy`. |

### Cap09: Admin Tools

**Purpose**: Authorized developers manage live game operations from the Admin panel: adjusting the global time multiplier, spawning new space objects, and inspecting the full database and game statistics.

#### Contained Features

- [Cap09_Feat001](#cap09_feat001-admin-authorization): Admin Authorization
- [Cap09_Feat002](#cap09_feat002-time-multiplier-management): Time Multiplier Management
- [Cap09_Feat003](#cap09_feat003-space-object-spawning): Space Object Spawning
- [Cap09_Feat004](#cap09_feat004-database--statistics-inspection): Database & Statistics Inspection

---

#### Cap09_Feat001: Admin Authorization

Admin features are restricted to developer accounts. Access is enforced on every admin endpoint.

| ID                   | Requirement                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap09_Feat001_Req001 | Admin endpoints require an authenticated session. Unauthenticated requests return `401 Unauthorized`.                                                                                                                         |
| Cap09_Feat001_Req002 | Within an authenticated session, admin access is further restricted to accounts with the username `a` or `q`. All other authenticated users receive `403 Forbidden` with the message "Admin access restricted to developers". |
| Cap09_Feat001_Req003 | The Admin page (`/admin`) displays an error banner and a retry button when the server returns a 403 response. Unauthorized users cannot perform any admin action.                                                             |

---

#### Cap09_Feat002: Time Multiplier Management

Admins can accelerate all time-based game mechanics (research, build times, iron generation, afterburner fuel, combat cooldowns) by setting a global time multiplier for a fixed duration.

| ID                   | Requirement                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cap09_Feat002_Req001 | Admin can read the current time multiplier (`GET /api/admin/time-multiplier`). The response includes the current multiplier value, the activation timestamp, the expiration timestamp, and the remaining seconds.                                |
| Cap09_Feat002_Req002 | Admin can set a new time multiplier (`POST /api/admin/time-multiplier`) by providing a multiplier ≥ 1 and a duration in minutes > 0. The multiplier expires automatically after the specified duration and resets to 1×.                         |
| Cap09_Feat002_Req003 | The time multiplier is stored in-memory only; it is not persisted to the database and resets to 1× on server restart.                                                                                                                            |
| Cap09_Feat002_Req004 | The Admin page provides preset buttons for common configurations (10× for 5 min, 100× for 5 min, 1000× for 5 min) and a custom form for arbitrary multiplier and duration values. A "Reset to 1×" button is shown when the multiplier is active. |
| Cap09_Feat002_Req005 | The Admin page polls the current multiplier status every 5 seconds and shows a live countdown timer for the remaining duration.                                                                                                                  |

---

#### Cap09_Feat003: Space Object Spawning

Admins can inject new collectible objects into the live game world at random positions.

| ID                   | Requirement                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cap09_Feat003_Req001 | Admin can spawn new space objects (`POST /api/admin/spawn-objects`) by specifying a type (`asteroid`, `shipwreck`, or `escape_pod`) and a quantity (1–50). The response returns the count of spawned objects and their newly assigned IDs. |
| Cap09_Feat003_Req002 | Spawned objects are placed at random positions within the world bounds with a random angle and a speed equal to the base speed for that type ±25%. They are immediately visible to all players via `GET /api/world`.                       |
| Cap09_Feat003_Req003 | The Admin page provides quick-spawn buttons (spawn 1, 5, or 10) for each object type, plus a custom form for arbitrary type and quantity. Spawn success and error messages are displayed and auto-clear after 5 seconds.                   |

---

#### Cap09_Feat004: Database & Statistics Inspection

Admins can view the full current state of the database (all users, space objects, and battles) and read per-player and global game statistics.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap09_Feat004_Req001 | Admin can retrieve a full database snapshot (`GET /api/admin/database`). Before querying, the server flushes all in-memory caches to the database to ensure the snapshot reflects the latest state. The response includes all users, all space objects, all battles, and summary counts.                                                                                                           |
| Cap09_Feat004_Req002 | The user snapshot includes each player's iron, XP, tech counts (all weapon and defense types), research levels, build queue, and battle state.                                                                                                                                                                                                                                                     |
| Cap09_Feat004_Req003 | The battle snapshot includes all active and completed battles with attacker/attackee IDs, start and end times, winner/loser, damage totals, and the number of battle log events.                                                                                                                                                                                                                   |
| Cap09_Feat004_Req004 | Any authenticated player can retrieve global and per-player statistics (`GET /api/statistics`). Statistics include combat totals (battles won/lost, damage dealt/received, iron transferred, XP awarded), collection totals (asteroids, shipwrecks, escape pods, iron from collection), and economy totals (iron spent on research, iron spent on builds, builds completed, research completions). |
| Cap09_Feat004_Req005 | The statistics endpoint also returns global aggregates (totals and averages across all players) and top-5 rankings per metric, which power the leaderboard best-in-category highlights. See [Cap02_Feat004: Leaderboard](#cap02_feat004-leaderboard).                                                                                                                                              |

### Cap10: Notifications

**Purpose**: Players receive in-game notifications about game events. Notifications are displayed on the Home page and can be managed and summarized.

> **Terminology note**: The system internally uses the term "messages" (API routes, database table, cache). The player-facing term is "Notifications". See [Arc42 Glossary](./architecture/arc42-architecture.md) for the legacy term mapping.

#### Contained Features

- [Cap10_Feat001](#cap10_feat001-notification-sources): Notification Sources
- [Cap10_Feat002](#cap10_feat002-notification-display): Notification Display
- [Cap10_Feat003](#cap10_feat003-notification-management): Notification Management
- [Cap10_Feat004](#cap10_feat004-notification-summarization): Notification Summarization

---

#### Cap10_Feat001: Notification Sources

Players receive notifications automatically when specific game events occur. Each event type produces a distinct notification.

| ID                   | Requirement                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap10_Feat001_Req001 | Player receives a welcome notification when their account is created.                                                                                                                                                |
| Cap10_Feat001_Req002 | Player receives a notification when they successfully collect an asteroid or shipwreck, stating the object type and the amount of iron received.                                                                     |
| Cap10_Feat001_Req003 | Player receives a notification when they collect an escape pod, naming the rescued commander and confirming the commander was added to inventory. See [Cap08: Inventory Management](#cap08-inventory-management).    |
| Cap10_Feat001_Req004 | Player receives a notification after each combat round showing their weapon, number of shots fired, shots that hit, and total damage dealt.                                                                          |
| Cap10_Feat001_Req005 | Player receives a notification after each combat round showing the enemy weapon, number of shots fired, shots that hit, and total damage received.                                                                   |
| Cap10_Feat001_Req006 | Player receives a notification when all shots in a combat round miss (attacker and defender each receive their respective miss notification).                                                                        |
| Cap10_Feat001_Req007 | Player receives a victory notification at battle end, stating iron gained, XP gained, and the opponent's name. See [Cap05: Combat System](#cap05-combat-system).                                                     |
| Cap10_Feat001_Req008 | Player receives a defeat notification at battle end, stating they were teleported away.                                                                                                                              |
| Cap10_Feat001_Req009 | Player receives a level-up notification when a battle victory causes them to reach a new level. See [Cap02: Game Hub & Player Status](#cap02-game-hub--player-status).                                               |
| Cap10_Feat001_Req010 | Player receives a notification when a build queue item completes, naming the completed item. See [Cap07: Factory & Manufacturing](#cap07-factory--manufacturing).                                                    |
| Cap10_Feat001_Req011 | Player receives a notification when a build queue is aborted due to insufficient iron, stating the item name and how many queued items were removed.                                                                 |
| Cap10_Feat001_Req012 | Player receives a notification when a research item reaches a new level, stating the research name, new level reached, and score awarded. See [Cap06: Research & Technology Tree](#cap06-research--technology-tree). |

---

#### Cap10_Feat002: Notification Display

Notifications are displayed on the Home page in a table. The display shows the most recent notifications first.

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap10_Feat002_Req001 | Notifications are displayed on the Home page as a chronological table, newest first.                                                                                                                                                                                                                                                                           |
| Cap10_Feat002_Req002 | Each notification entry shows the time (HH:MM:SS) and date (Mon DD) it was created.                                                                                                                                                                                                                                                                            |
| Cap10_Feat002_Req003 | Notifications are color-coded by type: positive events (collection successes, victories) display in green; negative events (incoming damage, defeats) display in red; neutral events (welcome, research, builds) use the default color. See [Arc42 Architecture](./architecture/arc42-architecture.md) for the prefix convention that drives color assignment. |
| Cap10_Feat002_Req004 | The 10 most recent notifications are shown by default. Player can expand to view all notifications.                                                                                                                                                                                                                                                            |
| Cap10_Feat002_Req005 | Notifications are pre-loaded on Home page render; player does not need to perform an action to see their current notifications.                                                                                                                                                                                                                                |
| Cap10_Feat002_Req006 | Player can manually refresh to fetch the latest notifications via a refresh button (`GET /api/messages`).                                                                                                                                                                                                                                                      |

---

#### Cap10_Feat003: Notification Management

Players can manage their notifications via read-state tracking.

| ID                   | Requirement                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Cap10_Feat003_Req001 | Each notification has a read/unread state. Newly created notifications start as unread.                    |
| Cap10_Feat003_Req002 | Player can mark all notifications as read at once via "Mark All as Read" (`POST /api/messages/mark-read`). |

---

#### Cap10_Feat004: Notification Summarization

Players can collapse all summarizable current notifications into a single summary notification that aggregates key game statistics.

| ID                   | Requirement                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cap10_Feat004_Req001 | Player can trigger summarization via a "Summarize" action (`POST /api/messages/summarize`). All summarizable current notifications are replaced by a single summary notification. |
| Cap10_Feat004_Req002 | The summary includes battle outcome stats: total victories and total defeats.                                                                                                     |
| Cap10_Feat004_Req003 | The summary includes damage stats: total damage dealt and total damage received across all recorded combat rounds.                                                                |
| Cap10_Feat004_Req004 | The summary includes shot accuracy stats for both the player and the enemy: total shots fired, total hits, and calculated accuracy percentage.                                    |
| Cap10_Feat004_Req005 | The summary includes collection stats: total asteroids collected, total shipwrecks collected, and total escape pods collected.                                                    |
| Cap10_Feat004_Req006 | The summary includes total iron collected from all collection events.                                                                                                             |
| Cap10_Feat004_Req007 | The summary includes build completion stats: for each completed item type, the item name and count are listed.                                                                    |
| Cap10_Feat004_Req008 | Notifications that cannot be parsed into a known stat category are preserved as individual notifications with their original timestamps after summarization.                      |
| Cap10_Feat004_Req009 | If a previous summary notification exists, its stats are accumulated into the new summary (cumulative totals across multiple summarization actions).                              |

---

## Document Format & Templates

This document uses a three-tier hierarchy for organizing requirements:

1. **Capabilities**: High-level functional areas (e.g., Authentication, Exploration)
2. **Features**: Cohesive groups of user-facing functionality within a capability
3. **Requirements**: Individual, testable requirements linked to features

### ID Convention

IDs follow a hierarchical pattern for readability:

- **Capability**: `CapNN` (2 digits, e.g., `Cap01`)
- **Feature**: `CapNN_FeatMMM` (3 digits for features, e.g., `Cap01_Feat001`)
- **Requirement**: `CapNN_FeatMMM_ReqZZZ` (3 digits, e.g., `Cap01_Feat001_Req001`)
- Requirements support deeper nesting for complex features (e.g., `Cap01_Feat001_Req001_SubReq001`)

### Template: Capability

A **Capability** is a major functional area that groups related features.

```markdown
### CapNN: [Capability Name]

**Purpose**: [One sentence describing the overall purpose and scope]

#### Contained Features

- [CapNN_FeatMMM]: [Feature Name]
- [CapNN_FeatMMM]: [Feature Name]
```

### Template: Feature

A **Feature** is a cohesive group of user-facing functionality within a capability.

```markdown
#### [CapNN_FeatMMM: Feature Name](#capnn_featmmm-feature-name)

[One-sentence description of what users can do with this feature. Link to related capabilities or features if relevant.]

| ID                   | Requirement                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| CapNN_FeatMMM_ReqZZZ | Requirement statement.                                                                             |
| CapNN_FeatMMM_ReqZZZ | [Link references to other docs, APIs, or features]: e.g., See [Cap01_Feat002](#cap01_feat002-...). |
```

### Template: Requirement

A **Requirement** is an individual, testable statement describing one aspect of a feature.

**Guidelines**:

- Each requirement should be independently testable
- Link to relevant API endpoints, configuration keys, or other requirements within the document
- Include numeric limits or conditions that bound the requirement
- Reference related requirements using markdown links for heavy cross-linking

**Example patterns**:

```
[Action] when [condition].
Display [element] with [attributes].
When [trigger], [system response].
Constraint: [description]. Linked to: [CapNN_FeatMMM](#capnn_featmmm-...).
```

### Cross-Linking Strategy

To maintain a tightly linked document:

1. **Capability Links**: Link from feature descriptions to their parent capability heading
2. **Feature Links**: Link between related features across capabilities (e.g., "See [Cap02_Feat002](#cap02_feat002-...)")
3. **Requirement Links**: Link requirements to specific APIs (`POST /api/harvest`), research tech names, or other requirements
4. **Back-References**: Use markdown anchors to enable bidirectional linking
5. **Table of Contents**: Auto-generate from headings for easy navigation
