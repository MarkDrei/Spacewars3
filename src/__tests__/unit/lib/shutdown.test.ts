import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createShutdownHandler,
  registerShutdownHandlers,
  runShutdownSteps,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  type ShutdownStep,
} from '@/lib/server/shutdown';

const step = (name: string, run: () => Promise<void>): ShutdownStep => ({ name, run });

describe('shutdown', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.spacewarsShutdownHandlersRegistered = undefined;
  });

  describe('runShutdownSteps', () => {
    it('runShutdownSteps_allStepsSucceed_runsInOrderAndReturnsTrue', async () => {
      const order: string[] = [];
      const steps = [
        step('battles', async () => void order.push('battles')),
        step('users', async () => void order.push('users')),
        step('statistics', async () => void order.push('statistics')),
      ];

      const result = await runShutdownSteps(steps);

      expect(result).toBe(true);
      expect(order).toEqual(['battles', 'users', 'statistics']);
    });

    it('runShutdownSteps_oneStepFails_stillRunsFollowingStepsAndReturnsFalse', async () => {
      const users = vi.fn(async () => {});
      const steps = [
        step('battles', async () => {
          throw new Error('database gone');
        }),
        step('users', users),
      ];

      const result = await runShutdownSteps(steps);

      expect(result).toBe(false);
      expect(users).toHaveBeenCalledTimes(1);
    });
  });

  describe('createShutdownHandler', () => {
    it('shutdownHandler_stepsSucceed_exitsWithZeroAfterTheSteps', async () => {
      const events: string[] = [];
      const handler = createShutdownHandler({
        steps: [step('users', async () => void events.push('flushed'))],
        exit: (code) => void events.push(`exit ${code}`),
      });

      await handler('SIGTERM');

      expect(events).toEqual(['flushed', 'exit 0']);
    });

    it('shutdownHandler_stepFails_exitsWithOne', async () => {
      const exit = vi.fn();
      const handler = createShutdownHandler({
        steps: [
          step('users', async () => {
            throw new Error('database gone');
          }),
        ],
        exit,
      });

      await handler('SIGTERM');

      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    });

    it('shutdownHandler_secondSignalWhileRunning_runsStepsOnlyOnce', async () => {
      const flush = vi.fn(async () => {});
      const exit = vi.fn();
      const handler = createShutdownHandler({ steps: [step('users', flush)], exit });

      await Promise.all([handler('SIGTERM'), handler('SIGINT')]);

      expect(flush).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    });

    it('shutdownHandler_stepHangs_exitsWithOneAfterTimeout', async () => {
      vi.useFakeTimers();
      const exit = vi.fn();
      const handler = createShutdownHandler({
        steps: [step('users', () => new Promise<void>(() => {}))],
        exit,
        timeoutMs: 500,
      });

      const running = handler('SIGTERM');
      await vi.advanceTimersByTimeAsync(499);
      expect(exit).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await running;

      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    });

    it('defaultTimeout_comparedToDockerGracePeriod_isBelowTenSeconds', () => {
      // Docker sends SIGKILL 10 s after SIGTERM; the handler has to report before that
      expect(DEFAULT_SHUTDOWN_TIMEOUT_MS).toBeLessThan(10_000);
    });
  });

  describe('registerShutdownHandlers', () => {
    it('registerShutdownHandlers_calledTwice_registersSigtermAndSigintOnce', () => {
      const on = vi.spyOn(process, 'on').mockImplementation(() => process);

      registerShutdownHandlers([]);
      registerShutdownHandlers([]);

      expect(on.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGINT']);
    });
  });
});
