import { vi, beforeEach } from 'vitest';

// The unit project runs without per-file isolation (isolate: false) for speed: external packages
// stay loaded across test files. Resetting the registry of project modules before each file keeps
// vi.mock() effective and gives every file fresh singletons, as with isolation.
vi.resetModules();

// Rate limit counters live on globalThis (one set per server process) and would otherwise carry
// over between tests: requests without X-Forwarded-For all count for the same client address.
beforeEach(() => {
  globalThis.authRateLimitsInstance = undefined;
});
