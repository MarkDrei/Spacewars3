# API Documentation

This document describes the available API endpoints for authentication, session management, and user/game data.

---

## POST /api/register

Register a new user.

- **Request Body:**

  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```

- **Response:**
  - Success: `{ "success": true }`
  - Error: `{ "error": "Username taken" | "Missing fields" | "Server error" }`

---

## POST /api/login

Authenticate a user and start a session.

- **Request Body:**

  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```

- **Response:**
  - Success: `{ "success": true }`
  - Error: `{ "error": "Invalid credentials" | "Missing fields" }`

---

## GET /api/session

Check if a user is currently logged in.

- **Response:**
  - Logged in: `{ "loggedIn": true, "username": "string" }`
  - Not logged in: `{ "loggedIn": false }`

---

## POST /api/logout

Log out the current user and destroy the session.

- **Response:**
  - `{ "success": true }`

---

## GET /api/user-stats

Get the current user's stats (iron, last update, iron per second).

- **Response:**

  ```json
  {
    "iron": number,
    "last_updated": number,
    "ironPerSecond": number
  }
  ```

  - Error: `{ "error": "Not authenticated" | "User not found" | "Server error" }`

---

## GET /api/techtree

Get the current user's tech tree and all research definitions.

- **Response:**

  ```json
  {
    "techTree": {
      "ironHarvesting": number,
      "shipVelocity": number,
      "afterburner": number,
      "activeResearch"?: {
        "type": "IronHarvesting" | "ShipVelocity" | "Afterburner",
        "remainingDuration": number
      }
    },
    "researches": {
      "IronHarvesting": {
        "type": "IronHarvesting",
        "name": string,
        "level": number,
        "baseUpgradeCost": number,
        "baseUpgradeDuration": number,
        "baseValue": number,
        "upgradeCostIncrease": number,
        "baseValueIncrease": { "type": "constant" | "factor", "value": number },
        "description": string
      },
      ...
    }
  }
  ```
  
  - Error: `{ "error": "Not authenticated" | "User not found" | "Server error" }`

---

**All endpoints expect and return JSON.**

**Note:**

- All endpoints (except `/api/session`) expect requests with `Content-Type: application/json`.
- Session cookies are used for authentication. The frontend must send requests with `credentials: 'include'`.
