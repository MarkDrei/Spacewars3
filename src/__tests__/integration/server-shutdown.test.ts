import { describe, it, expect, afterEach } from 'vitest';
import { cacheShutdownSteps } from '@/lib/server/main';
import { runShutdownSteps } from '@/lib/server/shutdown';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';

describe('cacheShutdownSteps', () => {
  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('cacheShutdownSteps_initializedServer_allStepsSucceed', async () => {
    await withTransaction(async () => {
      await initializeIntegrationTestServer();

      const allSucceeded = await runShutdownSteps(cacheShutdownSteps());

      expect(allSucceeded).toBe(true);
    });
  });

  it('cacheShutdownSteps_runTwice_secondRunAlsoSucceeds', async () => {
    await withTransaction(async () => {
      await initializeIntegrationTestServer();
      await runShutdownSteps(cacheShutdownSteps());

      // A second signal handler run (or a step repeated after a partial failure) must not fail
      const allSucceeded = await runShutdownSteps(cacheShutdownSteps());

      expect(allSucceeded).toBe(true);
    });
  });
});
