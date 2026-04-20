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

**Core Gameplay**: Players navigate the toroidal world through the [Exploration & Navigation](#cap03-exploration--navigation) system. The game world wraps at boundaries; navigation is controlled via click-to-move, speed/angle inputs, and teleportation when available.

**Core Economy**: Iron is the primary game currency, acquired through:

- **[Resource Gathering & Harvesting](#cap04-resource-gathering--harvesting)**: Passive iron generation over time, plus active collection from collectible objects (asteroids, shipwrecks, escape pods). Combat and trading with other players also yield iron.
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
  - [Cap02: Game Hub & Player Status](#cap02-game-hub--player-status)
  - [Cap03: Exploration & Navigation](#cap03-exploration--navigation)
  - [Cap04: Resource Gathering & Harvesting](#cap04-resource-gathering--harvesting)
  - [Cap05: Combat System](#cap05-combat-system)
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

Account creation, login, password recovery, and secure session management with HTTP-only cookies.

### Cap02: Game Hub & Player Status

Central dashboard displaying player progression, defense values, and active battles.

### Cap03: Exploration & Navigation

Navigate the toroidal world, set course and speed, manage viewport zoom, and observe game objects.

### Cap04: Resource Gathering & Harvesting

Iron is collected both passively and actively. Passive income is generated over time. Active collection includes harvesting collectibles (asteroids, shipwrecks, escape pods) using interception algorithms, as well as winning iron in combat or through trading with other players.

### Cap05: Combat System

Attack other players, manage combat state, and track battle outcomes and rewards.

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

(Authorization required) Manage game operations: adjust time multipliers, spawn space objects, view game statistics.

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
