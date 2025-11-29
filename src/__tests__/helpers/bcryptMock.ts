/**
 * Bcrypt Mock for Testing
 * 
 * Provides precomputed bcrypt hashes to speed up authentication tests.
 * This eliminates the need to hash passwords during test execution,
 * reducing test time by 50-70%.
 * 
 * All hashes use bcrypt rounds = 10 (matching production)
 */

// Precomputed bcrypt hashes for common test passwords
export const PRECOMPUTED_HASHES: Record<string, string> = {
  'a': '$2b$10$0q/od18qjo/fyCB8b.Dn2OZdKs1pKAOPwly98WEZzbsT.yavE6BY.',
  'dummy': '$2b$10$GJ2Bjb5Ruhd1hCnDxzEzxOmDAlgIy9.0ci11khzvsH0ta7q17K4ay',
  'q': '$2b$10$mV0R0OSohm5YjLDdttWtQOZcANRDw.vwIH2JdV.mLBLUPhYvby1Ae',
  'testpass123': '$2b$10$d8dOM7A1Ll449rWUtQZWcepcInTyqySN80niJclYVYFtAPjI0PvIC',
  'testpass': '$2b$10$nHBeHr1QP3Z13msELpYFtOHl6Ltczgeo.ovhYUf34iXwG/Hvbr6B2',
  'mypassword': '$2b$10$Mq/dVbLdyb153j15Gy2W/.eDeI2eXMfsSa027nNjtBbPLKw9coaOC',
  'right': '$2b$10$tZdBLxCIF0Lj.IdAd.GV.uoBUANCf8vp5nw0L6mmf9kx1/RlMLfH.',
  'wrong': '$2b$10$BkRbQtVrqWe2YV2sXbADIOOIHXrFc10C/9uosKLQkETODsUOd.ssK',
  'pass1': '$2b$10$oL.j6xG8XmyrrRRU9JOYWu1RTX3qngkyTQmgBsJsz5U3HErIbhC4y',
  'pass2': '$2b$10$GYEhgbKay8sWunut4nK9aeB/e/TGO.aO6J26z207LO55VLQdqniI2',
};

/**
 * Mock bcrypt.hash function
 * Returns precomputed hash if available, otherwise throws error
 */
export const mockHash = async (password: string): Promise<string> => {
  const hash = PRECOMPUTED_HASHES[password];
  if (!hash) {
    throw new Error(
      `No precomputed hash for password "${password}". ` +
      `Add it to PRECOMPUTED_HASHES in bcryptMock.ts or use real bcrypt for this test.`
    );
  }
  return hash;
};

/**
 * Mock bcrypt.compare function
 * Compares password against precomputed hash
 */
export const mockCompare = async (password: string, hash: string): Promise<boolean> => {
  const expectedHash = PRECOMPUTED_HASHES[password];
  return expectedHash === hash;
};

/**
 * Vitest mock factory for bcrypt module
 * Use in tests with: vi.mock('bcrypt', () => createBcryptMock())
 */
export const createBcryptMock = () => {
  const mockModule = {
    hash: mockHash,
    compare: mockCompare,
    hashSync: (password: string) => {
      const hash = PRECOMPUTED_HASHES[password];
      if (!hash) {
        throw new Error(`No precomputed hash for password "${password}"`);
      }
      return hash;
    },
    compareSync: (password: string, hash: string) => {
      const expectedHash = PRECOMPUTED_HASHES[password];
      return expectedHash === hash;
    },
    genSalt: async () => 'mocked_salt',
    genSaltSync: () => 'mocked_salt',
    getRounds: () => 10,
  };
  
  return {
    default: mockModule,
    ...mockModule,
  };
};
