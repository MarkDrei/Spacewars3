import { vi } from 'vitest';

// The unit project runs without per-file isolation (isolate: false) for speed: external packages
// stay loaded across test files. Resetting the registry of project modules before each file keeps
// vi.mock() effective and gives every file fresh singletons, as with isolation.
vi.resetModules();
