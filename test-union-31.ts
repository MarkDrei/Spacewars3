import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// Union with 31 members
type Union31 = 
    IronGuardLockContext<readonly [1]>
  | IronGuardLockContext<readonly [2]>
  | IronGuardLockContext<readonly [3]>
  | IronGuardLockContext<readonly [4]>
  | IronGuardLockContext<readonly [5]>
  | IronGuardLockContext<readonly [1, 2]>
  | IronGuardLockContext<readonly [1, 3]>
  | IronGuardLockContext<readonly [1, 4]>
  | IronGuardLockContext<readonly [1, 5]>
  | IronGuardLockContext<readonly [2, 3]>
  | IronGuardLockContext<readonly [2, 4]>
  | IronGuardLockContext<readonly [2, 5]>
  | IronGuardLockContext<readonly [3, 4]>
  | IronGuardLockContext<readonly [3, 5]>
  | IronGuardLockContext<readonly [4, 5]>;

function test(ctx: Union31): void {}
export type { Union31 };
