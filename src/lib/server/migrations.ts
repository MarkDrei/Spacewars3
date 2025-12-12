// ---
// Database migration system
// PostgreSQL version - using fresh database approach
// ---

/**
 * For PostgreSQL, we're using a fresh database approach as specified in requirements.
 * No complex migrations needed - just drop and recreate the schema when needed.
 * The schema is defined in schema.ts and applied on database initialization.
 */

// Export stubs for backward compatibility with any code that might import from this file
export function applyTechMigrations(): Promise<void> {
  // No-op for PostgreSQL - schema is applied during initialization
  return Promise.resolve();
}

export function applyMessagesMigrations(): Promise<void> {
  // No-op for PostgreSQL - schema is applied during initialization
  return Promise.resolve();
}

export function applyShipHullMigration(): Promise<void> {
  // No-op for PostgreSQL - schema is applied during initialization
  return Promise.resolve();
}

export function applyDefenseCurrentValuesMigration(): Promise<void> {
  // No-op for PostgreSQL - schema is applied during initialization
  return Promise.resolve();
}

export function applyBattleStateMigration(): Promise<void> {
  // No-op for PostgreSQL - schema is applied during initialization
  return Promise.resolve();
}

export function applyBattleEndStatsMigration(): Promise<void> {
  // No-op for PostgreSQL - schema is applied during initialization
  return Promise.resolve();
}
