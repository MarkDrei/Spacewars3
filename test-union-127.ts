import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// Union with 127 members
type Union127 = 
    IronGuardLockContext<readonly [1]>
  | IronGuardLockContext<readonly [2]>
  | IronGuardLockContext<readonly [3]>
  | IronGuardLockContext<readonly [4]>
  | IronGuardLockContext<readonly [5]>
  | IronGuardLockContext<readonly [6]>
  | IronGuardLockContext<readonly [7]>
  | IronGuardLockContext<readonly [1, 2]>
  | IronGuardLockContext<readonly [1, 3]>
  | IronGuardLockContext<readonly [1, 4]>
  | IronGuardLockContext<readonly [1, 5]>
  | IronGuardLockContext<readonly [1, 6]>
  | IronGuardLockContext<readonly [1, 7]>
  | IronGuardLockContext<readonly [2, 3]>
  | IronGuardLockContext<readonly [2, 4]>
  | IronGuardLockContext<readonly [2, 5]>
  | IronGuardLockContext<readonly [2, 6]>
  | IronGuardLockContext<readonly [2, 7]>
  | IronGuardLockContext<readonly [3, 4]>
  | IronGuardLockContext<readonly [3, 5]>
  | IronGuardLockContext<readonly [3, 6]>
  | IronGuardLockContext<readonly [3, 7]>
  | IronGuardLockContext<readonly [4, 5]>
  | IronGuardLockContext<readonly [4, 6]>
  | IronGuardLockContext<readonly [4, 7]>
  | IronGuardLockContext<readonly [5, 6]>
  | IronGuardLockContext<readonly [5, 7]>
  | IronGuardLockContext<readonly [6, 7]>;

function test(ctx: Union127): void {}
export type { Union127 };
