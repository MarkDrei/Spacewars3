import { describe, expect, test, beforeEach, afterEach } from 'vitest';

import { POST as setLocalePOST } from '@/app/api/set-locale/route';
import { getDatabase } from '@/lib/server/database';
import { createAuthenticatedSessionWithUser, createRequest } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';

describe('set-locale persistence', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  const readLocale = async (username: string): Promise<string> => {
    const db = await getDatabase();
    const result = await db.query('SELECT preferred_locale FROM users WHERE username = $1', [username]);
    return (result.rows[0] as { preferred_locale: string }).preferred_locale;
  };

  test('setLocale_authenticatedUser_persistsPreferredLocale', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('locale');
      expect(await readLocale(username)).toBe('en');

      const response = await setLocalePOST(
        createRequest('http://localhost:3000/api/set-locale', 'POST', { locale: 'de' }, sessionCookie)
      );

      expect(response.status).toBe(200);
      expect(await readLocale(username)).toBe('de');
    });
  });
});
