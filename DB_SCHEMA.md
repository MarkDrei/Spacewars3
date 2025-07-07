# Database Schema

This document describes the structure of the SQLite3 database used for authentication and user stats.

---

## users

Stores registered user credentials and user stats.

| Column        | Type     | Constraints                        | Description                        |
|-------------- |----------|------------------------------------|------------------------------------|
| id            | INTEGER  | PRIMARY KEY, AUTOINCREMENT         | User ID (unique)                   |
| username      | TEXT     | UNIQUE, NOT NULL                   | User's login name                  |
| password_hash | TEXT     | NOT NULL                           | Hashed password                    |
| iron          | REAL     | NOT NULL, DEFAULT 0.0              | Amount of iron the user has        |
| last_updated  | INTEGER  | NOT NULL, UNIX timestamp           | Last time the user's stats updated |
| tech_tree     | TEXT     | NOT NULL                           | User's tech tree (JSON-encoded)    |

**Create statement:**

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  iron REAL NOT NULL DEFAULT 0.0,
  last_updated INTEGER NOT NULL,
  tech_tree TEXT NOT NULL
);
```

---

**Notes:**

- Passwords are stored as bcrypt hashes for security.
- `iron` is a floating point value representing a user resource.
- `last_updated` is a UNIX timestamp (seconds since epoch) for stat updates.
- `tech_tree` stores the user's full tech tree as a JSON string (see `TechTree` interface in code).
- No per-research columns are kept; all research state is in `tech_tree`.
- Extend this file as you add more tables or relationships.
