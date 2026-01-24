/**
 * Base class for all cache implementations
 * Provides common functionality for test mode detection and persistence control
 * 
 * Common patterns:
 * - instances are singletons and stored in global this
 * - static async initialize() method creates the singleton instance
 * - static getInstance() method returns the singleton
 * - static resetInstance() clears the singleton instance (for testing)
 */
export abstract class Cache {
  /**
   * Test mode flag - automatically detects test environment
   * When true, background persistence should be disabled
   */
  protected readonly isTestMode: boolean = process.env.NODE_ENV === 'test';

  /**
   * Check if background persistence should be enabled
   * @param enableAutoPersistence - Configuration flag for auto-persistence
   * @returns true if persistence should be enabled, false otherwise
   */
  protected shouldEnableBackgroundPersistence(enableAutoPersistence: boolean): boolean {
    if (this.isTestMode) {
      return false;
    }
    return enableAutoPersistence;
  }

  protected persistenceTimer: NodeJS.Timeout | null = null;

  /**
   * Shuts down the cache, persisting any in-memory data to permanent storage.
   * Stops any background tasks.
   * 
   * Each cache implementation handles its own locking internally.
   * 
   * resetInstance() should be called after this to clear the singleton instance.
   */
  public async shutdown(): Promise<void> {
    this.stopBackgroundPersistence();
    await this.flushAllToDatabase();
  }

  /**
   * Flushes all in-memory data to permanent storage.
   * 
   * Each cache implementation handles its own locking internally.
   * Implementations should create their own lock context and call flushAllToDatabaseWithContext.
   */
  protected abstract flushAllToDatabase(): Promise<void>;

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