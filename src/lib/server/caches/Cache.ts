/**
 * Base class for all cache implementations.
 * Provides consistent lifecycle management and singleton pattern.
 */
export abstract class Cache {
  /**
   * Initialize the cache instance (async initialization)
   * Implementations should:
   * - Set up database connections
   * - Load initial data
   * - Start background tasks (e.g., persistence timers)
   */
  abstract initialize(...args: unknown[]): Promise<void>;

  /**
   * Shut down the cache instance gracefully
   * Implementations should:
   * - Stop background tasks
   * - Flush pending changes to database
   * - Clean up resources
   */
  abstract shutdown(): void;
}