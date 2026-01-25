/**
 * Base class for all cache implementations
 * Provides consistent lifecycle management and singleton patterns
 * 
 * Usage:
 * - Extend this class for all cache implementations
 * - Implement abstract methods: initialize(), shutdown()
 * - Use static getInstance() pattern with globalThis for singleton storage
 * - Use static resetInstance() for test cleanup
 */
export abstract class Cache {
  protected isInitialized = false;
  protected persistenceTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the cache with required dependencies
   * Must be called before using the cache
   */
  abstract initialize(...args: any[]): Promise<void>;

  /**
   * Shutdown the cache, stopping background tasks and flushing to database
   * Must be called during cleanup
   */
  abstract shutdown(): Promise<void>;

  /**
   * Start background persistence with specified interval
   * @param callback The persistence function to call periodically
   * @param intervalMs The interval in milliseconds
   */
  protected startBackgroundPersistence(callback: () => Promise<void>, intervalMs: number): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    this.persistenceTimer = setInterval(() => {
      callback().catch(error => {
        console.error('Background persistence error:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop background persistence
   */
  protected stopBackgroundPersistence(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }
  }
}