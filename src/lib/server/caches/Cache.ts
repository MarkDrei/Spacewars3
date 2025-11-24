import { LockContext, LocksAtMostAndHas4 } from "@markdrei/ironguard-typescript-locks";

/**
 * Base class for all cache implementations
 * 
 * Common patterns:
 * - instances are singletons and stored in global this
 * 
 * - static async initialize() method 
 * -- calls shutdown() on any existing instance
 * -- creates the singleton instance
 * -- takes all dependencies and configuration parameters
 * - static getInstance() method
 * - static resetInstance() clears the singleton instance (for testing)
 * 
 */
export abstract class Cache {

  protected persistenceTimer: NodeJS.Timeout | null = null;

  /**
   * Shuts down the cache, persisting any in-memory data to permanent storage.
   * Stops any background tasks.
   * 
   * resetInstance() should be called after this to clear the singleton instance.
   */
  public shutdown(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    this.stopBackgroundPersistence();
    return this.flushAllToDatabase(context);
  }

  /**
   * Flushes all in-memory data to permanent storage.
   */
  protected abstract flushAllToDatabase(context: LockContext<LocksAtMostAndHas4>): Promise<void>;


  /**
   * Starts background persistence tasks.
   * 
   * To be called in initialize() 
   * 
   * Needs to store the timer handle in this.persistenceTimer
   */
  protected abstract startBackgroundPersistence(): void;

    /**
   * Stop background persistence timer
   */
  protected stopBackgroundPersistence(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
      console.log('⏹️ Background persistence stopped');
    }
  }
}