import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';

// Union with 255 members
type Union255 = 
    IronGuardLockContext<readonly [1]>
  | IronGuardLockContext<readonly [2]>
  | IronGuardLockContext<readonly [3]>
  | IronGuardLockContext<readonly [4]>
  | IronGuardLockContext<readonly [5]>
  | IronGuardLockContext<readonly [6]>
  | IronGuardLockContext<readonly [7]>
  | IronGuardLockContext<readonly [8]>
  | IronGuardLockContext<readonly [1, 2]>
  | IronGuardLockContext<readonly [1, 3]>
  | IronGuardLockContext<readonly [1, 4]>
  | IronGuardLockContext<readonly [1, 5]>
  | IronGuardLockContext<readonly [1, 6]>
  | IronGuardLockContext<readonly [1, 7]>
  | IronGuardLockContext<readonly [1, 8]>
  | IronGuardLockContext<readonly [2, 3]>
  | IronGuardLockContext<readonly [2, 4]>
  | IronGuardLockContext<readonly [2, 5]>
  | IronGuardLockContext<readonly [2, 6]>
  | IronGuardLockContext<readonly [2, 7]>
  | IronGuardLockContext<readonly [2, 8]>
  | IronGuardLockContext<readonly [3, 4]>
  | IronGuardLockContext<readonly [3, 5]>
  | IronGuardLockContext<readonly [3, 6]>
  | IronGuardLockContext<readonly [3, 7]>
  | IronGuardLockContext<readonly [3, 8]>
  | IronGuardLockContext<readonly [4, 5]>
  | IronGuardLockContext<readonly [4, 6]>
  | IronGuardLockContext<readonly [4, 7]>
  | IronGuardLockContext<readonly [4, 8]>
  | IronGuardLockContext<readonly [5, 6]>
  | IronGuardLockContext<readonly [5, 7]>
  | IronGuardLockContext<readonly [5, 8]>
  | IronGuardLockContext<readonly [6, 7]>
  | IronGuardLockContext<readonly [6, 8]>
  | IronGuardLockContext<readonly [7, 8]>;

function test(ctx: Union255): void {}
export type { Union255 };
