# Game Page — Realised Requirements

This document describes what the game page currently offers to the player: what information is visible and what actions can be taken. Implementation details are intentionally omitted.

---

## Canvas View (800 × 800 px, circular viewport)

The main view is a circular canvas showing the immediate surroundings of the player's ship. The player's ship is always centred.

### What is visible

| Element | Information shown |
|---|---|
| **Player ship** | Ship image facing the current travel direction |
| **Other player ships** | Ship images facing their travel direction; username label below each ship |
| **Asteroids** | Asteroid image with animated dust/particle trail behind them |
| **Shipwrecks** | Shipwreck image |
| **Escape pods** | Escape pod image |
| **Grid** | Background grid for spatial orientation |
| **World boundary** | Visual border marking the edge of the explorable world (only in debug mode) |

### Radar / coordinate overlay (always on)

- Two concentric range rings centred on the player ship
- Crosshairs (horizontal + vertical lines) crossing the canvas centre
- World coordinate labels along both axes (every 100 units), indicating the player's absolute position in the world

### Hover tooltips (on mouse-over of any object)

When the cursor hovers over any object, a tooltip appears with:

- **Player ship**: Type, current speed, current heading angle
- **Asteroids**: Type, speed, heading angle, distance from player
- **Shipwrecks**: Type, speed, heading angle, distance from player
- **Escape pods**: Type, speed, heading angle, distance from player
- **Other ships**: Type, speed, heading angle, distance from player

### Targeting / attack feedback (temporary overlays)

After an attack is triggered, a fading overlay appears showing:

- A cyan line from the player ship to the attack target (fades out over time)
- A small crosshair marker at the target position

When intercept calculations are available, an additional overlay shows:

- A dashed blue-green line: the path the player's ship will travel to the intercept point
- A dashed orange-red line: the predicted path the target will travel to the same point
- A yellow diamond marker at the calculated intercept point
- A countdown timer (MM:SS) near the player ship showing estimated time to intercept

---

## Controls Panel (below the canvas)

### Speed control

- Numeric input showing the current travel speed; value can be edited
- **Set Speed** button — applies the entered speed
- **Set Max Speed** button — automatically sets speed to the ship's maximum
- **Stop** button — sets speed to zero

### Angle (heading) control

- Numeric input (0–360°) showing the current heading; value can be edited
- **Set Angle** button — applies the entered angle

### Teleport section *(only visible if the player has teleport charges)*

**Status display:**
- Current charges / maximum charges (e.g. "2 / 3 Charges")
- Countdown to next charge recharge ("Next in: Xm Ys")

**Coordinate teleport:**
- X coordinate input
- Y coordinate input
- **Teleport** button (disabled when no charges remain)

**Click-to-teleport toggle** (on the canvas overlay):
- Toggle switch labelled "Teleport" — when enabled, the next click on the canvas teleports the ship to the clicked world position (disabled when no charges remain)

### Attack mode

- Toggle switch on the canvas overlay labelled "Attack" — when enabled, the next click on the canvas initiates an attack against the clicked target; on a successful attack the player is redirected to the home page

### Debug toggle

- Toggle switch labelled "Enable debug drawings" — shows or hides world boundaries and the targeting line overlay

### Data age indicator *(visible when debug drawings are enabled)*

- Shows how long ago the world data was last fetched from the server, giving the player a sense of data freshness

---

## Information summary

| Category | Information available to the player |
|---|---|
| Position | Current X/Y world coordinates (visible on radar axes) |
| Movement | Current speed and heading angle (readable from inputs; also shown in ship tooltip on hover) |
| Surroundings | All objects within the viewport: asteroids, shipwrecks, escape pods, other player ships |
| Nearby objects detail | Type, speed, heading, distance (via hover tooltip) |
| Teleport resource | Current charges, max charges, recharge countdown |
| Combat feedback | Visual line to attacked target; interception point with time-to-intercept countdown |

---

## Interaction summary

| Action | How it is triggered |
|---|---|
| Set travel speed | Edit speed input + Set Speed button, or Set Max Speed button |
| Stop the ship | Stop button |
| Set heading angle | Edit angle input + Set Angle button |
| Teleport to coordinates | Enter X/Y + Teleport button |
| Teleport by clicking the map | Enable Teleport toggle, then click on canvas |
| Attack a target | Enable Attack toggle, then click on target on canvas |
| Toggle debug visuals | Enable debug drawings toggle |
