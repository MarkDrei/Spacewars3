import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// Union with 7 members
type Union7 = 
    IronGuardLockContext<readonly [1]>
  | IronGuardLockContext<readonly [2]>
  | IronGuardLockContext<readonly [3]>
  | IronGuardLockContext<readonly [1, 2]>
  | IronGuardLockContext<readonly [1, 3]>
  | IronGuardLockContext<readonly [2, 3]>;

function test(ctx: Union7): void {}
export type { Union7 };
