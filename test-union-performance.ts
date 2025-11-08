// EXPERIMENT: How bad is the TypeScript performance with large unions?
// Let's measure actual compilation time and see the real impact

import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// Helper to generate all combinations
type LockLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ===== BASELINE: Small union (7 members) =====
type Union7 = 
  | IronGuardLockContext<readonly [1]>
  | IronGuardLockContext<readonly [2]>
  | IronGuardLockContext<readonly [3]>
  | IronGuardLockContext<readonly [1, 2]>
  | IronGuardLockContext<readonly [1, 3]>
  | IronGuardLockContext<readonly [2, 3]>
  | IronGuardLockContext<readonly [1, 2, 3]>;

// ===== MEDIUM: 15 members (all subsets of 4 locks) =====
type Union15 = 
  | IronGuardLockContext<readonly [1]>
  | IronGuardLockContext<readonly [2]>
  | IronGuardLockContext<readonly [3]>
  | IronGuardLockContext<readonly [4]>
  | IronGuardLockContext<readonly [1, 2]>
  | IronGuardLockContext<readonly [1, 3]>
  | IronGuardLockContext<readonly [1, 4]>
  | IronGuardLockContext<readonly [2, 3]>
  | IronGuardLockContext<readonly [2, 4]>
  | IronGuardLockContext<readonly [3, 4]>
  | IronGuardLockContext<readonly [1, 2, 3]>
  | IronGuardLockContext<readonly [1, 2, 4]>
  | IronGuardLockContext<readonly [1, 3, 4]>
  | IronGuardLockContext<readonly [2, 3, 4]>
  | IronGuardLockContext<readonly [1, 2, 3, 4]>;

// ===== LARGE: 31 members (all subsets of 5 locks) =====
type Union31 = 
  | Union15
  | IronGuardLockContext<readonly [5]>
  | IronGuardLockContext<readonly [1, 5]>
  | IronGuardLockContext<readonly [2, 5]>
  | IronGuardLockContext<readonly [3, 5]>
  | IronGuardLockContext<readonly [4, 5]>
  | IronGuardLockContext<readonly [1, 2, 5]>
  | IronGuardLockContext<readonly [1, 3, 5]>
  | IronGuardLockContext<readonly [1, 4, 5]>
  | IronGuardLockContext<readonly [2, 3, 5]>
  | IronGuardLockContext<readonly [2, 4, 5]>
  | IronGuardLockContext<readonly [3, 4, 5]>
  | IronGuardLockContext<readonly [1, 2, 3, 5]>
  | IronGuardLockContext<readonly [1, 2, 4, 5]>
  | IronGuardLockContext<readonly [1, 3, 4, 5]>
  | IronGuardLockContext<readonly [2, 3, 4, 5]>
  | IronGuardLockContext<readonly [1, 2, 3, 4, 5]>;

// ===== VERY LARGE: 63 members (all subsets of 6 locks) =====
// Let's just add to Union31 incrementally...
type Union63 = 
  | Union31
  | IronGuardLockContext<readonly [6]>
  | IronGuardLockContext<readonly [1, 6]>
  | IronGuardLockContext<readonly [2, 6]>
  | IronGuardLockContext<readonly [3, 6]>
  | IronGuardLockContext<readonly [4, 6]>
  | IronGuardLockContext<readonly [5, 6]>
  | IronGuardLockContext<readonly [1, 2, 6]>
  | IronGuardLockContext<readonly [1, 3, 6]>
  | IronGuardLockContext<readonly [1, 4, 6]>
  | IronGuardLockContext<readonly [1, 5, 6]>
  | IronGuardLockContext<readonly [2, 3, 6]>
  | IronGuardLockContext<readonly [2, 4, 6]>
  | IronGuardLockContext<readonly [2, 5, 6]>
  | IronGuardLockContext<readonly [3, 4, 6]>
  | IronGuardLockContext<readonly [3, 5, 6]>
  | IronGuardLockContext<readonly [4, 5, 6]>
  | IronGuardLockContext<readonly [1, 2, 3, 6]>
  | IronGuardLockContext<readonly [1, 2, 4, 6]>
  | IronGuardLockContext<readonly [1, 2, 5, 6]>
  | IronGuardLockContext<readonly [1, 3, 4, 6]>
  | IronGuardLockContext<readonly [1, 3, 5, 6]>
  | IronGuardLockContext<readonly [1, 4, 5, 6]>
  | IronGuardLockContext<readonly [2, 3, 4, 6]>
  | IronGuardLockContext<readonly [2, 3, 5, 6]>
  | IronGuardLockContext<readonly [2, 4, 5, 6]>
  | IronGuardLockContext<readonly [3, 4, 5, 6]>
  | IronGuardLockContext<readonly [1, 2, 3, 4, 6]>
  | IronGuardLockContext<readonly [1, 2, 3, 5, 6]>
  | IronGuardLockContext<readonly [1, 2, 4, 5, 6]>
  | IronGuardLockContext<readonly [1, 3, 4, 5, 6]>
  | IronGuardLockContext<readonly [2, 3, 4, 5, 6]>
  | IronGuardLockContext<readonly [1, 2, 3, 4, 5, 6]>;

// Test functions
function acceptsUnion7(ctx: Union7): void {}
function acceptsUnion15(ctx: Union15): void {}
function acceptsUnion31(ctx: Union31): void {}
function acceptsUnion63(ctx: Union63): void {}

// Let's also test type inference - does TypeScript struggle?
type TestInference7 = Union7 extends infer U ? U : never;
type TestInference15 = Union15 extends infer U ? U : never;
type TestInference31 = Union31 extends infer U ? U : never;
type TestInference63 = Union63 extends infer U ? U : never;

console.log('=== TypeScript Union Performance Test ===\n');
console.log('This file defines unions of increasing size:');
console.log('  Union7:  7 members   (2^3 - 1)');
console.log('  Union15: 15 members  (2^4 - 1)');
console.log('  Union31: 31 members  (2^5 - 1)');
console.log('  Union63: 63 members  (2^6 - 1)');
console.log('\nTo test Union127 (127 members), uncomment the code below.');
console.log('To test Union255 (255 members), uncomment that too.');
console.log('To test Union511 (511 members), prepare for potential IDE lag!');
console.log('\nRun `npx tsc --noEmit --extendedDiagnostics test-union-performance.ts` to see timings.');
