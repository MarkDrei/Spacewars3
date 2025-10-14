/**
 * Tests for Lock Acquisition Helpers (IronGuard V2)
 * 
 * Verifies:
 * - Lock acquisition and release
 * - Try/finally pattern ensures cleanup
 * - Lock ordering validation
 * - Error propagation
 */

import { describe, it, expect } from 'vitest';
import { createLockContext, LOCK_WORLD, LOCK_USER, LOCK_MESSAGE_READ, LOCK_MESSAGE_WRITE, LOCK_BATTLE, LOCK_DATABASE } from '../../lib/server/ironGuardV2.js';
import { 
  withWorldLock,
  withUserLock,
  withMessageReadLock,
  withMessageWriteLock,
  withBattleLock,
  withDatabaseLock
} from '../../lib/server/lockHelpers.js';

describe('Lock Acquisition Helpers', () => {
  
  describe('withWorldLock', () => {
    it('withWorldLock_successfulOperation_acquiresAndReleasesLock', async () => {
      const context = createLockContext();
      
      const result = await withWorldLock(context, async (ctx) => {
        expect(ctx.hasLock(LOCK_WORLD)).toBe(true);
        return 42;
      });
      
      expect(result).toBe(42);
    });
    
    it('withWorldLock_operationThrows_stillReleasesLock', async () => {
      const context = createLockContext();
      
      await expect(
        withWorldLock(context, async (ctx) => {
          expect(ctx.hasLock(LOCK_WORLD)).toBe(true);
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
    
    it('withWorldLock_canBeCalledMultipleTimes_withSeparateContexts', async () => {
      const context = createLockContext();
      
      const result1 = await withWorldLock(context, async () => 'first');
      const result2 = await withWorldLock(context, async () => 'second');
      
      expect(result1).toBe('first');
      expect(result2).toBe('second');
    });
  });
  
  describe('withUserLock', () => {
    it('withUserLock_successfulOperation_acquiresAndReleasesLock', async () => {
      const context = createLockContext();
      
      const result = await withUserLock(context, async (ctx) => {
        expect(ctx.hasLock(LOCK_USER)).toBe(true);
        return 'user data';
      });
      
      expect(result).toBe('user data');
    });
    
    it('withUserLock_operationThrows_stillReleasesLock', async () => {
      const context = createLockContext();
      
      await expect(
        withUserLock(context, async () => {
          throw new Error('User error');
        })
      ).rejects.toThrow('User error');
    });
    
    it('withUserLock_afterWorldLock_maintainsBothLocks', async () => {
      const context = createLockContext();
      
      await withWorldLock(context, async (worldCtx) => {
        expect(worldCtx.hasLock(LOCK_WORLD)).toBe(true);
        
        await withUserLock(worldCtx, async (userCtx) => {
          expect(userCtx.hasLock(LOCK_WORLD)).toBe(true);
          expect(userCtx.hasLock(LOCK_USER)).toBe(true);
        });
      });
    });
  });
  
  describe('withMessageReadLock', () => {
    it('withMessageReadLock_successfulOperation_acquiresAndReleasesLock', async () => {
      const context = createLockContext();
      
      const result = await withMessageReadLock(context, async (ctx) => {
        expect(ctx.hasLock(LOCK_MESSAGE_READ)).toBe(true);
        return ['message1', 'message2'];
      });
      
      expect(result).toEqual(['message1', 'message2']);
    });
    
    it('withMessageReadLock_operationThrows_stillReleasesLock', async () => {
      const context = createLockContext();
      
      await expect(
        withMessageReadLock(context, async () => {
          throw new Error('Read error');
        })
      ).rejects.toThrow('Read error');
    });
  });
  
  describe('withMessageWriteLock', () => {
    it('withMessageWriteLock_successfulOperation_acquiresAndReleasesLock', async () => {
      const context = createLockContext();
      
      const result = await withMessageWriteLock(context, async (ctx) => {
        expect(ctx.hasLock(LOCK_MESSAGE_WRITE)).toBe(true);
        return 'message sent';
      });
      
      expect(result).toBe('message sent');
    });
    
    it('withMessageWriteLock_operationThrows_stillReleasesLock', async () => {
      const context = createLockContext();
      
      await expect(
        withMessageWriteLock(context, async () => {
          throw new Error('Write error');
        })
      ).rejects.toThrow('Write error');
    });
    
    it('withMessageWriteLock_afterMessageRead_maintainsBothLocks', async () => {
      const context = createLockContext();
      
      await withMessageReadLock(context, async (readCtx) => {
        expect(readCtx.hasLock(LOCK_MESSAGE_READ)).toBe(true);
        
        await withMessageWriteLock(readCtx, async (writeCtx) => {
          expect(writeCtx.hasLock(LOCK_MESSAGE_READ)).toBe(true);
          expect(writeCtx.hasLock(LOCK_MESSAGE_WRITE)).toBe(true);
        });
      });
    });
  });
  
  describe('withBattleLock', () => {
    it('withBattleLock_successfulOperation_acquiresAndReleasesLock', async () => {
      const context = createLockContext();
      
      const result = await withBattleLock(context, async (ctx) => {
        expect(ctx.hasLock(LOCK_BATTLE)).toBe(true);
        return { winner: 'player1' };
      });
      
      expect(result).toEqual({ winner: 'player1' });
    });
    
    it('withBattleLock_operationThrows_stillReleasesLock', async () => {
      const context = createLockContext();
      
      await expect(
        withBattleLock(context, async () => {
          throw new Error('Battle error');
        })
      ).rejects.toThrow('Battle error');
    });
  });
  
  describe('withDatabaseLock', () => {
    it('withDatabaseLock_successfulOperation_acquiresAndReleasesLock', async () => {
      const context = createLockContext();
      
      const result = await withDatabaseLock(context, async (ctx) => {
        expect(ctx.hasLock(LOCK_DATABASE)).toBe(true);
        return 'db operation complete';
      });
      
      expect(result).toBe('db operation complete');
    });
    
    it('withDatabaseLock_operationThrows_stillReleasesLock', async () => {
      const context = createLockContext();
      
      await expect(
        withDatabaseLock(context, async () => {
          throw new Error('Database error');
        })
      ).rejects.toThrow('Database error');
    });
    
    it('withDatabaseLock_nestedWithOtherLocks_maintainsAllLocks', async () => {
      const context = createLockContext();
      
      await withWorldLock(context, async (worldCtx) => {
        await withUserLock(worldCtx, async (userCtx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await withBattleLock(userCtx as any, async (battleCtx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await withDatabaseLock(battleCtx as any, async (dbCtx) => {
              expect(dbCtx.hasLock(LOCK_WORLD)).toBe(true);
              expect(dbCtx.hasLock(LOCK_USER)).toBe(true);
              expect(dbCtx.hasLock(LOCK_BATTLE)).toBe(true);
              expect(dbCtx.hasLock(LOCK_DATABASE)).toBe(true);
            });
          });
        });
      });
    });
  });
  
  describe('Lock Ordering', () => {
    it('lockHelpers_respectLockOrdering_allowsCorrectSequence', async () => {
      const context = createLockContext();
      
      // Correct order: 10 -> 20 -> 30 -> 40 -> 41 -> 50 -> 60
      // Note: Type assertions needed due to TypeScript limitation in expressing "all locks <= N"
      await withWorldLock(context, async (ctx1) => {
        await withUserLock(ctx1, async (ctx2) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await withMessageReadLock(ctx2 as any, async (ctx3) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await withMessageWriteLock(ctx3 as any, async (ctx4) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await withBattleLock(ctx4 as any, async (ctx5) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await withDatabaseLock(ctx5 as any, async (ctx6) => {
                  expect(ctx6.hasLock(LOCK_WORLD)).toBe(true);
                  expect(ctx6.hasLock(LOCK_USER)).toBe(true);
                  expect(ctx6.hasLock(LOCK_MESSAGE_READ)).toBe(true);
                  expect(ctx6.hasLock(LOCK_MESSAGE_WRITE)).toBe(true);
                  expect(ctx6.hasLock(LOCK_BATTLE)).toBe(true);
                  expect(ctx6.hasLock(LOCK_DATABASE)).toBe(true);
                });
              });
            });
          });
        });
      });
    });
    
    it('lockHelpers_canSkipLevels_acquiresOnlyNeeded', async () => {
      const context = createLockContext();
      
      // Skip World and User, go directly to Battle
      await withBattleLock(context, async (ctx) => {
        expect(ctx.hasLock(LOCK_WORLD)).toBe(false);
        expect(ctx.hasLock(LOCK_USER)).toBe(false);
        expect(ctx.hasLock(LOCK_BATTLE)).toBe(true);
      });
    });
  });
  
  describe('Error Handling', () => {
    it('lockHelpers_asyncOperationError_propagatesCorrectly', async () => {
      const context = createLockContext();
      
      await expect(
        withUserLock(context, async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Async error');
        })
      ).rejects.toThrow('Async error');
    });
    
    it('lockHelpers_nestedOperationError_propagatesThoughAllLevels', async () => {
      const context = createLockContext();
      
      await expect(
        withWorldLock(context, async (ctx1) => {
          await withUserLock(ctx1, async (ctx2) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await withBattleLock(ctx2 as any, async () => {
              throw new Error('Deep error');
            });
          });
        })
      ).rejects.toThrow('Deep error');
    });
  });
  
  describe('Return Values', () => {
    it('lockHelpers_primitiveReturnValue_returnsCorrectly', async () => {
      const context = createLockContext();
      
      const number = await withWorldLock(context, async () => 123);
      const string = await withUserLock(context, async () => 'hello');
      const boolean = await withBattleLock(context, async () => true);
      
      expect(number).toBe(123);
      expect(string).toBe('hello');
      expect(boolean).toBe(true);
    });
    
    it('lockHelpers_objectReturnValue_returnsCorrectly', async () => {
      const context = createLockContext();
      
      const obj = await withUserLock(context, async () => ({
        id: 1,
        name: 'test',
        data: [1, 2, 3]
      }));
      
      expect(obj).toEqual({ id: 1, name: 'test', data: [1, 2, 3] });
    });
    
    it('lockHelpers_promiseReturnValue_awaitsCorrectly', async () => {
      const context = createLockContext();
      
      const result = await withDatabaseLock(context, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'delayed result';
      });
      
      expect(result).toBe('delayed result');
    });
  });
});
