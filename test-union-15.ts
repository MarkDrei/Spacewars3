import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// Union with 15 members
type Union15 = 
    IronGuardLockContext<readonly [1]>
  | IronGuardLockContext<readonly [2]>
  | IronGuardLockContext<readonly [3]>
  | IronGuardLockContext<readonly [4]>
  | IronGuardLockContext<readonly [1, 2]>
  | IronGuardLockContext<readonly [1, 3]>
  | IronGuardLockContext<readonly [1, 4]>
  | IronGuardLockContext<readonly [2, 3]>
  | IronGuardLockContext<readonly [2, 4]>
  | IronGuardLockContext<readonly [3, 4]>;

function test(ctx: Union15): void {}
export type { Union15 };
