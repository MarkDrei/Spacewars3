/**
 * Graceful shutdown.
 *
 * Game state lives in in-memory caches that are written to the database every 30-60 s. Without a
 * final flush every restart (each deployment recreates the container) loses the changes since the
 * last background persist. The handler runs the shutdown steps, then ends the process.
 */

export interface ShutdownStep {
  name: string;
  run: () => Promise<void>;
}

export interface ShutdownHandlerOptions {
  steps: ShutdownStep[];
  /** Ends the process. Injected for tests. */
  exit: (code: number) => void;
  /** Upper bound for all steps together; must stay below the grace period of the process manager. */
  timeoutMs?: number;
}

/** Docker sends SIGKILL 10 s after SIGTERM; stop waiting before that and report the failure. */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 8000;

/**
 * Runs all steps in order. A failing step does not stop the following ones: what can still be
 * saved is saved.
 * @returns true when every step succeeded
 */
export async function runShutdownSteps(steps: ShutdownStep[]): Promise<boolean> {
  let allSucceeded = true;
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      allSucceeded = false;
      console.error(`❌ Shutdown step "${step.name}" failed:`, error);
    }
  }
  return allSucceeded;
}

/**
 * Creates the signal handler: runs the steps once (further signals are ignored while it runs) and
 * exits with 0 when everything was saved, with 1 after a failed step or a timeout.
 */
export function createShutdownHandler(options: ShutdownHandlerOptions): (signal: string) => Promise<void> {
  const { steps, exit, timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS } = options;
  let started = false;

  return async (signal: string): Promise<void> => {
    if (started) {
      return;
    }
    started = true;
    console.log(`🛑 ${signal} received - saving cached game state`);

    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });
    const result = await Promise.race([runShutdownSteps(steps), timedOut]);
    clearTimeout(timer);

    if (result === 'timeout') {
      console.error(`❌ Shutdown did not finish within ${timeoutMs} ms - exiting, unsaved changes are lost`);
      exit(1);
    } else if (result) {
      console.log('✅ Cached game state saved - exiting');
      exit(0);
    } else {
      exit(1);
    }
  };
}

declare global {
  var spacewarsShutdownHandlersRegistered: boolean | undefined; // required for globalThis augmentation
}

/**
 * Registers the handler for SIGTERM and SIGINT, once per process.
 *
 * Next.js registers its own handlers for both signals, which end the process as soon as the HTTP
 * server is closed, usually before the flush is done. The production image therefore sets
 * `NEXT_MANUAL_SIG_HANDLE=true`, which leaves signal handling to this handler. Without the
 * variable (`next dev`, `next start`) the flush is best effort.
 */
export function registerShutdownHandlers(steps: ShutdownStep[]): void {
  if (globalThis.spacewarsShutdownHandlersRegistered) {
    return;
  }
  globalThis.spacewarsShutdownHandlersRegistered = true;

  const handler = createShutdownHandler({ steps, exit: (code) => process.exit(code) });
  process.on('SIGTERM', () => void handler('SIGTERM'));
  process.on('SIGINT', () => void handler('SIGINT'));
}
