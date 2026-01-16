import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';
import { createBcryptMock } from './helpers/bcryptMock';

// Mock bcrypt globally for all tests to use precomputed hashes
// This provides a 50-70% speedup for authentication tests
vi.mock('bcrypt', () => createBcryptMock());

// Initialize test database once before all tests
beforeAll(async () => {
  const { getDatabase } = await import('@/lib/server/database');
  await getDatabase(); // This will initialize the database with seed data
});

// Global cleanup after each test to prevent async operations from leaking
afterEach(async () => {
  // Brief delay to allow any lingering async operations to complete
  // This helps prevent foreign key violations in PostgreSQL when
  // subsequent tests reset the database
  // 25ms is a compromise between safety and test performance
  await new Promise(resolve => setTimeout(resolve, 25));
});

// Note: Transaction-based test isolation is implemented but not enabled globally yet
// Individual integration tests use initializeIntegrationTestServer() which resets caches
// Each test's database changes are automatically rolled back via withTransaction wrapper

