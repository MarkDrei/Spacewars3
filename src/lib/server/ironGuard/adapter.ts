/**
 * Adapter to bridge IronGuard compile-time lock ordering with runtime async mutexes
 * 
 * IronGuard provides compile-time lock ordering validation.
 * This adapter wraps runtime mutexes to work with IronGuard contexts.
 */

import { LockContext } from './core';
import type { LockLevel } from './types';

export class AsyncMutex<Level extends LockLevel> {
  private locked = false;
  private queue: Array<() => void> = [];
  private readonly level: Level;
  private readonly name: string;
  
  constructor(name: string, level: Level) {
    this.name = name;
    this.level = level;
  }
  
  async acquire<T, THeld extends readonly LockLevel[]>(
    context: LockContext<THeld>,
    fn: (ctx: LockContext<readonly [...THeld, Level]>) => Promise<T>
  ): Promise<T> {
    // Compile-time: CanAcquire check enforced by LockContext.acquire()
    // Runtime: Traditional mutex queuing
    
    return new Promise<T>((resolve, reject) => {
      const runLocked = async () => {
        try {
          const newCtx = context.acquire(this.level);
          if (typeof newCtx === 'string') {
            throw new Error(newCtx);
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

export class AsyncReadWriteLock<ReadLevel extends LockLevel, WriteLevel extends LockLevel> {
  private readers = 0;
  private writer = false;
  private readQueue: Array<() => void> = [];
  private writeQueue: Array<() => void> = [];
  private readonly name: string;
  private readonly readLevel: ReadLevel;
  private readonly writeLevel: WriteLevel;

  constructor(name: string, readLevel: ReadLevel, writeLevel: WriteLevel) {
    this.name = name;
    this.readLevel = readLevel;
    this.writeLevel = writeLevel;
  }

  async read<T, THeld extends readonly LockLevel[]>(
    context: LockContext<THeld>,
    fn: (ctx: LockContext<readonly [...THeld, ReadLevel]>) => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const runRead = async () => {
        this.readers++;
        try {
          const newCtx = context.acquire(this.readLevel);
          if (typeof newCtx === 'string') {
            throw new Error(newCtx);
          }
          const result = await fn(newCtx);
          this.readers--;
          this.checkQueues();
          resolve(result);
        } catch (error) {
          this.readers--;
          this.checkQueues();
          reject(error);
        }
      };

      if (this.writer || this.writeQueue.length > 0) {
        this.readQueue.push(runRead);
      } else {
        runRead();
      }
    });
  }

  async write<T, THeld extends readonly LockLevel[]>(
    context: LockContext<THeld>,
    fn: (ctx: LockContext<readonly [...THeld, WriteLevel]>) => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const runWrite = async () => {
        this.writer = true;
        try {
          const newCtx = context.acquire(this.writeLevel);
          if (typeof newCtx === 'string') {
            throw new Error(newCtx);
          }
          const result = await fn(newCtx);
          this.writer = false;
          this.checkQueues();
          resolve(result);
        } catch (error) {
          this.writer = false;
          this.checkQueues();
          reject(error);
        }
      };

      if (this.writer || this.readers > 0) {
        this.writeQueue.push(runWrite);
      } else {
        runWrite();
      }
    });
  }

  private checkQueues(): void {
    // Process write queue first (writers have priority when readers are done)
    if (!this.writer && this.readers === 0 && this.writeQueue.length > 0) {
      const nextWriter = this.writeQueue.shift()!;
      nextWriter();
    }
    // Process read queue if no writers are waiting or active
    else if (!this.writer && this.writeQueue.length === 0 && this.readQueue.length > 0) {
      // Allow all waiting readers to proceed
      const waitingReaders = [...this.readQueue];
      this.readQueue = [];
      waitingReaders.forEach(reader => reader());
    }
  }

  getStats(): { readers: number; writer: boolean; readQueue: number; writeQueue: number } {
    return {
      readers: this.readers,
      writer: this.writer,
      readQueue: this.readQueue.length,
      writeQueue: this.writeQueue.length
    };
  }
}
