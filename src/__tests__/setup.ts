import '@testing-library/jest-dom';
import { vi, beforeAll } from 'vitest';
import { createBcryptMock } from './helpers/bcryptMock';

// Mock bcrypt globally for all tests to use precomputed hashes
// This provides a 50-70% speedup for authentication tests
vi.mock('bcrypt', () => createBcryptMock());

// Initialize test database once before all tests
beforeAll(async () => {
  const { getDatabase } = await import('@/lib/server/database');
  await getDatabase(); // This will initialize the database with seed data
});
