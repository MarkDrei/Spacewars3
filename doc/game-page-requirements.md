# Game Page Requirements

This document captures the realized requirements for the Game Page (`/game`). It is intentionally free of implementation details and intended as a reference for designing alternative UIs.

---

## Overview

The Game Page is the primary gameplay screen. It renders the game world on a canvas and provides controls for navigating the player's ship, teleporting, and toggling visual settings.

---

## Canvas / Game World Display

- **Game Canvas** — A responsive square canvas that fills the available viewport, rendering the space world in real time. The canvas dynamically sizes to `min(viewport-width − 40px, viewport-height − 200px)` so it uses maximum screen real-estate on any device.
  - Updates every 3 seconds via server polling.
  - Renders: asteroids, escape pods, shipwrecks, the player's ship, other ships, trajectories, and debug overlays.
  - **Click-to-Navigate** — Clicking on the canvas with no mode active sets a navigation target. The input fields update to reflect the clicked course.
  - **Click-to-Teleport mode** — When enabled, clicking the canvas teleports the ship to that world coordinate and consumes one teleport charge.
  - **Click-to-Attack mode** — When enabled, clicking on the canvas fires a weapon at the selected target. A successful attack redirects the player to the home page.

---

## Navigation Controls

The player controls their ship's movement via two parameters:

### Speed
- **Speed input** — Numeric field (min 0, step 0.1). Shows current ship speed.
- **Set Speed button** — Sends the entered speed to the server. Shows "Setting…" while in flight.
- **Set Max Speed button** — Queries ship stats for the maximum speed and applies it immediately.
- **Stop button** — Sets ship speed to 0 immediately.

### Angle
- **Angle input** — Numeric field (degrees, 0–360, step 0.1). Shows current heading.
- **Set Angle button** — Sends the entered angle to the server. Shows "Setting…" while in flight.
- Both speed and angle inputs accept `Enter` to submit.

---

## Teleport Controls

Shown only when the player has unlocked at least one teleport charge slot.

- **Teleport header**
  - Title: "Teleport"
  - **Charges badge** — Displays current and maximum charges (e.g., "3 / 5 Charges"). Charges refill over time.
  - **Recharge timer** — Shows time until the next charge refills (e.g., "Next in: 2m 30s"). Hidden when fully charged.
- **Coordinate inputs** — Two numeric fields for X and Y destination coordinates (world space, 0–5000).
- **Teleport button** — Executes the teleport. Disabled when no charges remain or while a teleport is in progress.
- **Canvas toggle: Teleport mode** — Overlay toggle on the canvas (bottom-right). When enabled, the next canvas click teleports the ship preserving its velocity. Disabled when charges < 1.

---

## Combat Controls

- **Canvas toggle: Attack mode** — Overlay toggle on the canvas (bottom-left). When enabled, the next canvas click fires a weapon at the target under the cursor.

---

## Visual / Debug Settings

- **Debug drawings toggle** — Enables/disables visual debug overlays on the canvas (trajectory lines, vectors, bounding boxes, etc.).
- **Data Age Indicator** — Shown when debug drawings are enabled. Displays how stale the last server update is, as a visual freshness indicator.

---

## Loading & Error States

- **Loading state** — Shown while world data is being fetched on first load.
- **Error state** — Shown if world data fails to load, with the error message.

---

## Global Behavior

- The page is **authenticated-only** — unauthenticated users are redirected to `/login`.
- World data auto-refreshes every 3 seconds in the background.
- Teleport charges regenerate in real time on the client (optimistic update), based on the server-provided recharge rate and the current time multiplier.
- Time multiplier (turbo mode) affects how fast teleport charges regenerate.
