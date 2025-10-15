/**
 * Adapter to bridge IronGuard compile-time lock ordering with runtime async mutexes
 * 
 * IronGuard provides compile-time lock ordering validation via the LockContext type system.
 * This adapter wraps runtime mutexes to work with IronGuard contexts and enforces
 * lock ordering at both compile-time and runtime.
 */


import { LockContext, type CanAcquire } from './core';
import type { LockLevel } from './types';

/**
 * Async mutex that integrates with IronGuard's compile-time lock ordering
 */
export class AsyncMutex<Level extends LockLevel> {
  private locked = false;
  private queue: Array<() => void> = [];
  private readonly level: Level;
  private readonly name: string;
  
  constructor(name: string, level: Level) {
    this.name = name;
    this.level = level;
  }
  
  /**
   * Acquire mutex with compile-time lock ordering validation
   * @param context Current IronGuard lock context
   * @param fn Function to execute with lock held
   * @returns Promise with result, or compilation error if lock order violated
   */
  async acquire<T, THeld extends readonly LockLevel[]>(
    context: LockContext<THeld>,
    fn: (ctx: LockContext<readonly [...THeld, Level]>) => Promise<T>
  ): Promise<T> {
    // Compile-time check: can only acquire if lock level is valid
    type ValidationCheck = CanAcquire<THeld, Level>;
    const _check: ValidationCheck = true as ValidationCheck;
    
    return new Promise<T>((resolve, reject) => {
      const runLocked = async () => {
        try {
          // Acquire lock in IronGuard context (compile-time safe)
          const newCtx = context.acquire(this.level);
          if (typeof newCtx === 'string') {
            throw new Error(`Lock acquisition failed: ${newCtx}`);
          }
          
          const result = await fn(newCtx);
          this.release();
          resolve(result);
        } catch (error) {
          this.release();
          reject(error);
        }
      };
      
      if (this.locked) {
        this.queue.push(runLocked);
      } else {
        this.locked = true;
        runLocked();
      }
    });
  }
  
  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
  
  isLocked(): boolean {
    return this.locked;
  }
  
  getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * Async read-write lock that integrates with IronGuard
 * Uses a single lock level for compile-time ordering but manages
 * multiple readers vs single writer at runtime
 */
export class AsyncReadWriteLock<ReadLevel extends LockLevel, WriteLevel extends LockLevel> {
  private readers = 0;
  private writer = false;
  private readQueue: Array<() => void> = [];
  private writeQueue: Array<() => void> = [];
  private readonly readLevel: ReadLevel;
  private readonly writeLevel: WriteLevel;
  private readonly name: string;
  
  constructor(name: string, readLevel: ReadLevel, writeLevel: WriteLevel) {
    this.name = name;
    this.readLevel = readLevel;
    this.writeLevel = writeLevel;
  }
  
  /**
   * Acquire read lock with compile-time validation
   */
  async acquireRead<T, THeld extends readonly LockLevel[]>(
    context: LockContext<THeld>,
    fn: (ctx: LockContext<readonly [...THeld, ReadLevel]>) => Promise<T>
  ): Promise<T> {
    // Compile-time check
    type ValidationCheck = CanAcquire<THeld, ReadLevel>;
    const _check: ValidationCheck = true as ValidationCheck;
    
    return new Promise<T>((resolve, reject) => {
      const runWithReadLock = async () => {
        try {
          this.readers++;
          
          const newCtx = context.acquire(this.readLevel);
          if (typeof newCtx === 'string') {
            throw new Error(`Read lock acquisition failed: ${newCtx}`);
          }
          
          const result = await fn(newCtx);
          this.releaseRead();
          resolve(result);
        } catch (error) {
          this.releaseRead();
          reject(error);
        }
      };
      
      // Can acquire read if no writer
      if (!this.writer && this.writeQueue.length === 0) {
        runWithReadLock();
      } else {
        this.readQueue.push(runWithReadLock);
      }
    });
  }
  
  /**
   * Acquire write lock with compile-time validation
   */
  async acquireWrite<T, THeld extends readonly LockLevel[]>(
    context: LockContext<THeld>,
    fn: (ctx: LockContext<readonly [...THeld, WriteLevel]>) => Promise<T>
  ): Promise<T> {
    // Compile-time check
    type ValidationCheck = CanAcquire<THeld, WriteLevel>;
    const _check: ValidationCheck = true as ValidationCheck;
    
    return new Promise<T>((resolve, reject) => {
      const runWithWriteLock = async () => {
        try {
          this.writer = true;
          
          const newCtx = context.acquire(this.writeLevel);
          if (typeof newCtx === 'string') {
            throw new Error(`Write lock acquisition failed: ${newCtx}`);
          }
          
          const result = await fn(newCtx);
          this.releaseWrite();
          resolve(result);
        } catch (error) {
          this.releaseWrite();
          reject(error);
        }
      };
      
      // Can acquire write if no readers and no writer
      if (this.readers === 0 && !this.writer) {
        runWithWriteLock();
      } else {
        this.writeQueue.push(runWithWriteLock);
      }
    });
  }
  
  private releaseRead(): void {
    this.readers--;
    
    // If no more readers and write is waiting, grant write
    if (this.readers === 0 && this.writeQueue.length > 0) {
      const next = this.writeQueue.shift()!;
      next();
    }
  }
  
  private releaseWrite(): void {
    this.writer = false;
    
    // Prefer readers over writers (read-preferring lock)
    if (this.readQueue.length > 0) {
      // Grant all waiting reads
      const allReads = [...this.readQueue];
      this.readQueue = [];
      allReads.forEach(read => read());
    } else if (this.writeQueue.length > 0) {
      const next = this.writeQueue.shift()!;
      next();
    }
  }
  
  getStats() {
    return {
      readers: this.readers,
      writer: this.writer,
      readQueueLength: this.readQueue.length,
      writeQueueLength: this.writeQueue.length
    };
  }
}
