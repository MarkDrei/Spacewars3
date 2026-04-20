# Functional Requirements — Spacewars Ironstrike

**Version:** 1.0  
**Date:** April 20, 2026  
**Status:** Work in Progress

---

## Purpose and Scope

This document is the **authoritative feature overview** for *Spacewars Ironstrike*. It serves two purposes:

1. **Requirements reference** — Describes all user-facing features and the rules governing them. Linked from the [arc42 architecture document](./architecture/arc42-architecture.md) as the external requirements document (see arc42 §1.2).
2. **Balancing analysis base** — Future sections of this document will define user journeys (e.g. "energy weapon focus strategy"), calculate resource curves over time, and present generated charts showing how different play styles affect power progression. These scenarios allow systematic review of game balance.

**Scope:** All pages and features accessible to authenticated players, including the admin toolset. Hardware-level details (browser rendering, network protocols) are out of scope.

---

## Table of Contents

1. [Functional Requirement Conventions](#1-functional-requirement-conventions)
2. [Authentication & Account Management](#2-authentication--account-management)
3. [Home — Game Hub](#3-home--game-hub)
4. [Game Page — Space Navigation & Combat](#4-game-page--space-navigation--combat)
5. [Research — Technology Tree](#5-research--technology-tree)
6. [Factory — Build Weapons & Defense](#6-factory--build-weapons--defense)
7. [Ship — Inventory & Bridge Management](#7-ship--inventory--bridge-management)
8. [Starbase — Commander Economy](#8-starbase--commander-economy)
9. [Profile — Statistics & History](#9-profile--statistics--history)
10. [Admin Toolset](#10-admin-toolset)
11. [Cross-Cutting Rules](#11-cross-cutting-rules)
12. [Open Questions / TBD](#12-open-questions--tbd)

---

## 1. Functional Requirement Conventions

- Requirements use **SHALL** (mandatory) or **SHOULD** (recommended).
- Each requirement has an ID: `FR-<PAGE>-<NNN>` (e.g. `FR-GAME-001`).
- Referenced API endpoints are the server-side contracts; client behaviour must match.
- Numeric limits without an explicit source annotation are derived from the current implementation and should be validated when game balancing is reviewed.

---

## 2. Authentication & Account Management

### 2.1 Login / Registration (`/login`)

| ID | Requirement |
|----|-------------|
| FR-AUTH-001 | The system SHALL display a combined Sign-In / Sign-Up / Forgot-Password form. |
| FR-AUTH-002 | Sign-In requires username + password. On success the system SHALL redirect to the last visited protected page or `/game`. |
| FR-AUTH-003 | Sign-Up requires username, password, and confirmed password. Email is optional. Passwords must match. |
| FR-AUTH-004 | After successful registration the system SHALL redirect the user to the game page within 3 seconds. |
| FR-AUTH-005 | Forgot-Password sends a reset-link to the registered email. The link contains a time-limited token. |
| FR-AUTH-006 | A default test user (username `a`, password `a`) SHALL exist in all environments and does not require email verification. |
| FR-AUTH-007 | Error messages SHALL be shown inline (red). Success messages SHALL be shown inline (green). |

### 2.2 Reset Password (`/reset-password`)

| ID | Requirement |
|----|-------------|
| FR-AUTH-010 | The reset form requires a new password and a confirmation; both must match. |
| FR-AUTH-011 | An expired or invalid token SHALL show a descriptive error. |
| FR-AUTH-012 | On success the system SHALL redirect to `/login` after 2 seconds. |

### 2.3 Logout

| ID | Requirement |
|----|-------------|
| FR-AUTH-020 | Logout SHALL clear the server session (iron-session cookie) and redirect to `/login`. |
| FR-AUTH-021 | Any authenticated API call after logout SHALL return 401. |

---

## 3. Home — Game Hub (`/home`)

The home page is the central hub shown after login. It summarises the player's current state and acts as a notification centre.

### 3.1 Status Header

| ID | Requirement |
|----|-------------|
| FR-HOME-001 | The system SHALL display the player's current level, score, total XP, and XP required for the next level. |
| FR-HOME-002 | Active commander bonuses (summed from bridge slots) SHALL be shown. |

### 3.2 Defense Values

| ID | Requirement |
|----|-------------|
| FR-HOME-010 | The system SHALL display current and maximum values for Hull, Armor, and Shield as colour-coded health bars. |
| FR-HOME-011 | Defense values SHALL regenerate at 1 point per second (outside battles). |
| FR-HOME-012 | Maximum defense values equal 100 × the corresponding tech count. |
| FR-HOME-013 | Defense values SHALL be polled from the server every 5 seconds. |

### 3.3 Battle Status

| ID | Requirement |
|----|-------------|
| FR-HOME-020 | While an active battle exists, the system SHALL display: opponent name, attacker/defender role, cumulative damage dealt and received. |
| FR-HOME-021 | Per-weapon cooldown timers SHALL be shown with remaining time. |

### 3.4 Messages / Notifications

| ID | Requirement |
|----|-------------|
| FR-HOME-030 | Messages are colour-coded by prefix: `A:` = attack (red), `N:` = negative (red), `P:` = positive (green), no prefix = neutral. |
| FR-HOME-031 | The system SHALL support bold text within messages using `**text**` markers. |
| FR-HOME-032 | The player SHALL be able to Mark All as Read, Refresh, and request a Summary of older messages. |
| FR-HOME-033 | Messages SHALL be sorted newest-first. |

---

## 4. Game Page — Space Navigation & Combat (`/game`)

The game page contains the primary real-time play loop. It renders a 5 000 × 5 000 unit toroidal world on an HTML5 Canvas.

### 4.1 World & Rendering

| ID | Requirement |
|----|-------------|
| FR-GAME-001 | The world is toroidal: objects and ships wrap to the opposite side when leaving the world boundary. |
| FR-GAME-002 | The player's ship SHALL always be rendered at the centre of the viewport; the world scrolls around it. |
| FR-GAME-003 | The player can zoom between `MIN_ZOOM` and `MAX_ZOOM` (3.0). The zoom preference SHALL persist across sessions via `localStorage`. |
| FR-GAME-004 | World state SHALL be polled from the server every 3 seconds. Client-side position interpolation compensates for network latency. |
| FR-GAME-005 | Rendered object types: player ship, other player ships (colour-coded by level difference), asteroids, shipwrecks, escape pods, starbases. |

### 4.2 Navigation

| ID | Requirement |
|----|-------------|
| FR-GAME-010 | Clicking empty space SHALL set the ship's heading angle toward the clicked point (POST `/api/navigate`). |
| FR-GAME-011 | A speed slider (0 – max speed) SHALL allow the player to set current speed. Value is confirmed on pointer-up. |
| FR-GAME-012 | An angle input (0 – 360°) with a "Set" button SHALL allow precise direction entry. |
| FR-GAME-013 | A zoom slider SHALL update the viewport immediately; value is persisted to `localStorage`. |

### 4.3 Resource Collection (Harvest)

| ID | Requirement |
|----|-------------|
| FR-GAME-020 | Collectible object types: Asteroid, Shipwreck, Escape Pod. |
| FR-GAME-021 | A player can harvest a collectible if the distance to it is ≤ 125 world units (POST `/api/harvest`). |
| FR-GAME-022 | Clicking a collectible at distance > 125 units SHALL set the ship's course to an intercept trajectory (accounting for object velocity and ship speed). |
| FR-GAME-023 | On successful harvest, the system SHALL display an announcement with the iron reward amount for 2.5 seconds. |
| FR-GAME-024 | Collectibles respawn at server-determined locations after being harvested. |

### 4.4 Combat

| ID | Requirement |
|----|-------------|
| FR-GAME-030 | Attack mode is toggled via a dedicated button (⚔️); the game starts with attack mode OFF. |
| FR-GAME-031 | A player may only attack another player whose level is within ±3 of their own. |
| FR-GAME-032 | Attacks are only possible when the target is within 100 world units (POST `/api/attack`). |
| FR-GAME-033 | Clicking a player at distance > 100 units in attack mode SHALL calculate and set an intercept course toward that player. |
| FR-GAME-034 | A successful attack initiation SHALL redirect the attacker to the home page. |
| FR-GAME-035 | Other players' ships are colour-coded by level difference to the local player. |

### 4.5 Starbase Docking

| ID | Requirement |
|----|-------------|
| FR-GAME-040 | Starbases are stationary. Their interaction radius is 350 world units. |
| FR-GAME-041 | If the player is within 350 units and attack mode is ON, clicking a starbase SHALL redirect to `/starbase`. |
| FR-GAME-042 | Clicking a starbase at distance > 350 units SHALL set an intercept course. |

### 4.6 Teleportation

| ID | Requirement |
|----|-------------|
| FR-GAME-050 | Teleport is available only if the player has researched the teleport technology. |
| FR-GAME-051 | The player has a finite number of charges that recharge over time. Charge count and recharge countdown SHALL be displayed. |
| FR-GAME-052 | The player may teleport by entering manual X / Y coordinates (0–5 000) via a modal. |
| FR-GAME-053 | Click-to-teleport mode allows the player to tap any canvas point as the teleport destination. |
| FR-GAME-054 | Each teleport consumes exactly 1 charge (POST `/api/teleport`). |

### 4.7 Afterburner

| ID | Requirement |
|----|-------------|
| FR-GAME-060 | Afterburner is available only when the corresponding research level ≥ 1. |
| FR-GAME-061 | While active, the afterburner increases the ship's maximum speed to `boosted_speed` from the tech tree. |
| FR-GAME-062 | The afterburner has a fuel gauge (0–100 %). It can only be activated above a minimum fuel threshold. |
| FR-GAME-063 | After deactivation or fuel depletion a cooldown period begins before recharging starts. |
| FR-GAME-064 | Fuel percentage, status (active/ready/recharging), and time estimates SHALL be displayed in the UI. |

### 4.8 HUD & Feedback

| ID | Requirement |
|----|-------------|
| FR-GAME-070 | A radar/crosshair overlay in the top-left corner SHALL show current coordinates and the 125-unit collection radius. |
| FR-GAME-071 | Hovering over any space object SHALL display a tooltip showing type, distance, and relevant reward values. |
| FR-GAME-072 | A debug mode (🐛) SHALL optionally render collision boundaries and interception lines. Preference persists in `localStorage`. |
| FR-GAME-073 | Announcements (collection results, mode toggles, errors) SHALL appear on-canvas and auto-dismiss after 2.5 seconds. |

---

## 5. Research — Technology Tree (`/research`)

### 5.1 General

| ID | Requirement |
|----|-------------|
| FR-RES-001 | The research page SHALL display all available technologies grouped into 5 categories: Projectile Weapons, Energy Weapons, Defense, Ship, Spies. |
| FR-RES-002 | Each technology card/row SHALL show: name, description, current level, upgrade cost (iron), upgrade duration, current effect value and unit. |
| FR-RES-003 | A tooltip (ℹ️) SHALL show a progression table for the next 20 levels (cost and effect per level). |
| FR-RES-004 | The player SHALL be able to toggle between a Card view and a Table view. |
| FR-RES-005 | The current iron amount SHALL be visible at the top of the page. |

### 5.2 Starting Research

| ID | Requirement |
|----|-------------|
| FR-RES-010 | Clicking "Upgrade" on a technology queues a research job (POST `/api/trigger-research`). |
| FR-RES-011 | A progress bar SHALL be shown for any technology currently being researched. |
| FR-RES-012 | Cost is deducted immediately on start; the level increases when research completes. |

### 5.3 Technology Categories and Types

**Projectile Weapons:** projectileDamage, reloadRate (projectile), accuracy (projectile), weaponTier (projectile)  
**Energy Weapons:** energyDamage, rechargeRate, accuracy (energy), weaponTier (energy)  
**Defense:** hullStrength, repairSpeed, armor, shield, shieldRechargeRate  
**Ship:** shipSpeed, afterburner (duration, boost, fuel), teleport (charges, recharge), capacity, slots (inventory / bridge), ironHarvesting, constructionSpeed  
**Spies:** spyChance, spySpeed, sabotage, counterintel, stealIron

---

## 6. Factory — Build Weapons & Defense (`/factory`)

### 6.1 General

| ID | Requirement |
|----|-------------|
| FR-FAC-001 | The factory page SHALL support building 6 weapon types and 4 defense types. |
| FR-FAC-002 | The player SHALL see: image, name, subtype (Projectile/Energy), owned count, base cost (iron), build duration, stats (damage, accuracy, reload), advantages/disadvantages. |
| FR-FAC-003 | The player SHALL be able to toggle between Card and Table views. |

### 6.2 Build Queue

| ID | Requirement |
|----|-------------|
| FR-FAC-010 | The system SHALL display the active build queue with item name, type, and time remaining. |
| FR-FAC-011 | A player SHALL be able to build 1–N units of an item in one queuing action by adjusting the quantity with ± buttons (long-press for rapid increment/decrement). |
| FR-FAC-012 | Sufficient iron is required; the Build button SHALL be disabled when iron is insufficient. |
| FR-FAC-013 | Built items reduce iron immediately and are added to inventory on completion. |

### 6.3 Weapon Types

| Name | Subtype | Tier |
|------|---------|------|
| Pulse Laser | Energy | 1 — weak, high accuracy, good vs. armor |
| Auto Turret | Projectile | 1 — cheap, fast reload |
| Plasma Lance | Energy | 2 — medium damage |
| Gauss Rifle | Projectile | 2 — medium, anti-armor |
| Photon Torpedo | Energy | 3 — strong |
| Rocket Launcher | Projectile | 3 — strong |

### 6.4 Defense Types

| Name | Type | Effect |
|------|------|--------|
| Ship Hull | Passive | Base hull points |
| Kinetic Armor | Passive | Anti-projectile |
| Energy Shield | Passive | Anti-energy |
| Missile Jammer | Passive | Anti-missile |

### 6.5 Cheat Mode (Developer)

| ID | Requirement |
|----|-------------|
| FR-FAC-020 | Users `a` and `q` SHALL have access to an "⚡ Complete First Build" button that instantly completes the top queue item. |

---

## 7. Ship — Inventory & Bridge Management (`/ship`)

### 7.1 Inventory

| ID | Requirement |
|----|-------------|
| FR-SHIP-001 | The inventory is a grid of slots; maximum slots are determined by the `capacity` research level. |
| FR-SHIP-002 | The inventory SHALL display each item with image, name, and stat bonuses. |
| FR-SHIP-003 | Items can be sorted by any stat, ascending or descending. |

### 7.2 Bridge

| ID | Requirement |
|----|-------------|
| FR-SHIP-010 | The bridge displays active commanders; maximum bridge slots are determined by the `slots` research level. |
| FR-SHIP-011 | Commanders on the bridge contribute their stat bonuses to the active ship stats (summed). |
| FR-SHIP-012 | The active ship stat bonuses SHALL be shown on the bridge section. |

### 7.3 Item Management

| ID | Requirement |
|----|-------------|
| FR-SHIP-020 | Players can move commanders between inventory and bridge by drag-and-drop (desktop) or a touch-compatible auto-drop zone (mobile). |
| FR-SHIP-021 | Right-click (or long-press on mobile) SHALL open a context menu with item actions (details, remove). |
| FR-SHIP-022 | Status messages for transfers SHALL auto-clear after 3 seconds. |

---

## 8. Starbase — Commander Economy (`/starbase`)

### 8.1 Buying Commanders

| ID | Requirement |
|----|-------------|
| FR-SB-001 | The shop panel SHALL list available commanders with portrait, name, stat bonuses, and buy price. |
| FR-SB-002 | Buying a commander deducts the listed iron price and adds the commander to inventory. |
| FR-SB-003 | The Buy button SHALL be disabled when: iron is insufficient, or the inventory is full. |

### 8.2 Selling Commanders

| ID | Requirement |
|----|-------------|
| FR-SB-010 | The sell panel SHALL list owned commanders with portrait, name, stat bonuses, and sell price. |
| FR-SB-011 | Selling a commander removes it from inventory and credits the listed iron price. |

### 8.3 Commander Stats

Commanders can carry bonuses for the following 10 stats (percentage-based):
Projectile Damage, Projectile Reload Rate, Projectile Accuracy, Energy Damage, Energy Reload Rate, Energy Accuracy, Hull Strength, Shield, Armor, Speed.

### 8.4 Sorting

| ID | Requirement |
|----|-------------|
| FR-SB-020 | Both panels (sell/buy) SHALL support sorting by any commander stat or none, ascending or descending. |

---

## 9. Profile — Statistics & History (`/profile`)

### 9.1 Player Info

| ID | Requirement |
|----|-------------|
| FR-PRO-001 | The profile SHALL display: avatar initial, username, current level, score, total XP. |
| FR-PRO-002 | The player SHALL be able to change their password via a dialog requiring current password, new password, and confirmation. |

### 9.2 Statistics

| ID | Requirement |
|----|-------------|
| FR-PRO-010 | Statistics SHALL be grouped into 4 categories: Combat, Collection, Economy, XP/Progression. |
| FR-PRO-011 | Each stat SHALL show the player's value alongside the global average. |
| FR-PRO-012 | Top-5 global rankings in each category SHALL be highlighted with rank badges (🥇🥈🥉). |

#### Tracked Stats

**Combat:** Battles Won, Battles Lost, Damage Dealt, Damage Received, Iron Transferred from Battles  
**Collection:** Asteroids Collected, Shipwrecks Collected, Escape Pods Collected, Iron from Collection  
**Economy:** Iron Spent on Research, Iron Spent on Builds, Research Count, Builds Completed  
**XP/Progression:** Total XP, Level

### 9.3 Leaderboard

| ID | Requirement |
|----|-------------|
| FR-PRO-020 | Global rankings SHALL be available by score and XP. |
| FR-PRO-021 | Best-in-category rankings SHALL cover at least 14 categories combining all stat groups. |

### 9.4 Battle History

| ID | Requirement |
|----|-------------|
| FR-PRO-030 | The player's battles SHALL be listed chronologically (newest first). |
| FR-PRO-031 | Each entry SHALL show: result (Victory/Defeat), role (Attacker/Defender), opponent username, damage dealt/received, duration, timestamp. |

---

## 10. Admin Toolset (`/admin`)

Access is restricted to users `a` and `q`.

### 10.1 Database Overview

| ID | Requirement |
|----|-------------|
| FR-ADM-001 | The admin page SHALL display record counts and collapsible data tables for: Users, Space Objects, Battles. |

### 10.2 Time Multiplier

| ID | Requirement |
|----|-------------|
| FR-ADM-010 | The admin SHALL be able to set a global time multiplier (≥ 1×) for a specified duration (in minutes). |
| FR-ADM-011 | Preset buttons SHALL exist for: 2× / 30 min, 5× / 15 min, 10× / 10 min. |
| FR-ADM-012 | A reset button SHALL set the multiplier back to 1×. |
| FR-ADM-013 | Current multiplier and remaining time (MM:SS) SHALL be displayed. |

### 10.3 Space Object Spawning

| ID | Requirement |
|----|-------------|
| FR-ADM-020 | The admin SHALL be able to spawn Asteroids, Shipwrecks, and Escape Pods individually or in bulk. |
| FR-ADM-021 | Preset buttons: 1 and 10 of each type. A custom form allows 1–50 of any type. |
| FR-ADM-022 | Spawn confirmation SHALL be shown for 5 seconds. |

---

## 11. Cross-Cutting Rules

### 11.1 Iron Economy

| ID | Requirement |
|----|-------------|
| FR-ECON-001 | Iron is the sole currency; all costs (research, factory, starbase) are iron-denominated. |
| FR-ECON-002 | Iron is gained from: harvesting space objects, winning/completing battles, selling commanders. |
| FR-ECON-003 | Iron is deducted at the point of action (research start, build queue, buy commander). |

### 11.2 Authentication & Access Control

| ID | Requirement |
|----|-------------|
| FR-SEC-001 | All pages except `/login` and `/reset-password` require authentication. Unauthenticated access SHALL redirect to `/login`. |
| FR-SEC-002 | Session management uses HTTP-only iron-session cookies. |

### 11.3 Polling & Realtime Updates

| ID | Requirement |
|----|-------------|
| FR-RT-001 | World state (game page) is polled every 3 seconds. |
| FR-RT-002 | Defense values (home page) are polled every 5 seconds. |
| FR-RT-003 | Afterburner status is polled when active or below 100 % fuel. |

### 11.4 Level & Progression

| ID | Requirement |
|----|-------------|
| FR-PROG-001 | Player level is derived from total XP. |
| FR-PROG-002 | XP is awarded for battles, collections, and research (specific amounts TBD in balancing). |
| FR-PROG-003 | Combat is restricted to players within ±3 levels. |

---

## 12. Open Questions / TBD

These items require decisions before balancing scenarios can be computed:

| # | Topic | Question |
|---|-------|---------|
| 1 | Defense regen | Is the 1/s regen rate subject to the time multiplier? |
| 2 | Harvest iron amounts | What is the exact iron yield per object type and does it scale with level/research? |
| 3 | Battle resolution | How is total battle damage calculated and over what time window? |
| 4 | XP awards | Exact XP tables for collections, battles, research are not documented. |
| 5 | Commander drop rates | How are commanders generated in the starbase shop (random stats? fixed pool?)? |
| 6 | Spy system | Spy mechanics (sabotage, counterintelligence) are researched but UI is not yet visible. |
| 7 | Afterburner threshold | What is the minimum fuel % required to activate afterburner? |
| 8 | Level cap | Is there a maximum level? What is the XP curve? |

---

*Future additions to this document: user journey definitions, strategy paths (e.g. energy-weapon focus, fortress build, scout build), and auto-generated balance charts.*
