// ---
// TypeScript Compile-Time Deadlock Prevention System
// Phase 2: Simplified Typed Cache Manager 
// ---

import { 
  TypedMutex, 
  TypedReadWriteLock, 
  type LockContext, 
  type EmptyContext, 
  type Locked,
  type CacheLevel,
  type WorldLevel,
  type UserLevel,
  type MessageReadLevel,
  type MessageWriteLevel,
  type BattleLevel,
  type DatabaseLevel,
  createEmptyContext
} from './ironGuardSystem';
import { User } from './user';
import { World, type SpaceObject } from './world';
import { getDatabase } from './database';
import { Message, UnreadMessage } from './messagesRepo';
import { loadWorldFromDb, saveWorldToDb } from './worldRepo';
import { getUserByIdFromDb, getUserByUsernameFromDb } from './userRepo';
import type { Battle } from '../../shared/battleTypes';
import { BattleRepo } from './battleRepo';
import sqlite3 from 'sqlite3';

// Type aliases for lock contexts to improve readability and avoid 'any'
// Type aliases for lock contexts to improve readability and avoid 'any'
type WorldReadContext = LockContext<Locked<'world:read'>, CacheLevel | WorldLevel>;
type WorldWriteContext = LockContext<Locked<'world:write'>, CacheLevel | WorldLevel>;
type UserContext = LockContext<Locked<'user'>, CacheLevel | WorldLevel | UserLevel>;
type BattleContext = LockContext<Locked<'battle'>, CacheLevel | WorldLevel | UserLevel | BattleLevel>;
type DatabaseReadContext = LockContext<Locked<'database:read'>, CacheLevel | WorldLevel | UserLevel | BattleLevel | DatabaseLevel>;
type DatabaseWriteContext = LockContext<Locked<'database:write'>, CacheLevel | WorldLevel | UserLevel | BattleLevel | DatabaseLevel>;

// Context type for data access methods - accepts any context that provides the required lock
type WorldAccessContext = WorldReadContext | WorldWriteContext | UserContext | BattleContext | DatabaseReadContext | DatabaseWriteContext;
type UserAccessContext = UserContext | BattleContext | DatabaseReadContext | DatabaseWriteContext;
type BattleAccessContext = BattleContext | DatabaseReadContext | DatabaseWriteContext;
type DatabaseAccessContext = DatabaseReadContext | DatabaseWriteContext;

// Cache configuration interface
export interface TypedCacheConfig {
  persistenceIntervalMs: number;
  enableAutoPersistence: boolean;
  logStats: boolean;
}

// Cache statistics interface
export interface TypedCacheStats {
  userCacheSize: number;
  usernameCacheSize: number;
  messageCacheSize: number;
  battleCacheSize: number;
  worldCacheHits: number;
  worldCacheMisses: number;
  userCacheHits: number;
  userCacheMisses: number;
  messageCacheHits: number;
  messageCacheMisses: number;
  battleCacheHits: number;
  battleCacheMisses: number;
  dirtyUsers: number;
  dirtyMessages: number;
  dirtyBattles: number;
  worldDirty: boolean;
}

/**
 * Typed Cache Manager with compile-time deadlock prevention
 * Enforces singleton pattern and lock ordering
 */
export class TypedCacheManager {
  // Singleton enforcement
  private static instance: TypedCacheManager | null = null;
  private constructor() {
    console.log('🧠 Typed cache manager initialized');
  }

  static getInstance(config?: TypedCacheConfig): TypedCacheManager {
    if (!this.instance) {
      this.instance = new TypedCacheManager();
      if (config) {
        this.instance.config = config;
      }
    }
    return this.instance;
  }

  // Reset singleton for testing
  static resetInstance(): void {
    this.instance = null;
  }

  // Core infrastructure
  private config: TypedCacheConfig = {
    persistenceIntervalMs: 30000,
    enableAutoPersistence: true,
    logStats: false
  };
  private db: sqlite3.Database | null = null;
  private isInitialized = false;
  private persistenceTimer: NodeJS.Timeout | null = null;

  // Typed locks with explicit level assignment
  private cacheManagementLock = new TypedMutex('cache-mgmt', 0 as CacheLevel);
  private worldLock = new TypedReadWriteLock('world', 1 as WorldLevel, 1 as WorldLevel);
  private userLock = new TypedMutex('user', 2 as UserLevel);
  private messageLock = new TypedReadWriteLock('message', 2.4 as MessageReadLevel, 2.5 as MessageWriteLevel);
  private battleLock = new TypedMutex('battle', 2.8 as BattleLevel);
  private databaseLock = new TypedReadWriteLock('database', 3 as DatabaseLevel, 3 as DatabaseLevel);

  // In-memory cache storage
  private users: Map<number, User> = new Map();
  private world: World | null = null;
  private userMessages: Map<number, Message[]> = new Map(); // userId -> messages
  private battles: Map<number, Battle> = new Map(); // battleId -> battle
  private usernameToUserId: Map<string, number> = new Map(); // username -> userId mapping
  private dirtyUsers: Set<number> = new Set();
  private worldDirty: boolean = false;
  private dirtyMessages: Set<number> = new Set(); // userIds with dirty messages
  private dirtyBattles: Set<number> = new Set(); // battleIds with dirty battles

  // Statistics
  private stats = {
    worldCacheHits: 0,
    worldCacheMisses: 0,
    userCacheHits: 0,
    userCacheMisses: 0,
    messageCacheHits: 0,
    messageCacheMisses: 0,
    battleCacheHits: 0,
    battleCacheMisses: 0
  };

  /**
   * Check if cache manager is initialized
   */
  get isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Initialize the cache manager - must be called before use
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const emptyCtx = createEmptyContext();
    
    await this.cacheManagementLock.acquire(emptyCtx, async () => {
      if (this.isInitialized) {
        return; // Double-check inside lock
      }

      console.log('🚀 Initializing typed cache manager...');

      // Initialize database connection
      this.db = await getDatabase();
      console.log('✅ Database connected');

      // Load world data
      await this.initializeWorld();
      console.log('✅ World data loaded');

      // Start background persistence if enabled
      this.startBackgroundPersistence();

      // Start battle scheduler
      this.startBattleScheduler();

      this.isInitialized = true;
      console.log('✅ Typed cache manager initialization complete');
    });
  }

  /**
   * Load world data from database into cache
   */
  private async initializeWorld(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const emptyCtx = createEmptyContext();
    
    await this.databaseLock.read(emptyCtx, async (dbCtx: DatabaseReadContext) => {
      await this.worldLock.write(dbCtx, async () => {
        console.log('🌍 Loading world data from database...');
        this.world = await loadWorldFromDb(this.db!, async () => {
          this.worldDirty = true;
        });
        this.worldDirty = false;
        this.stats.worldCacheMisses++;
        console.log('🌍 World data cached in memory');
      });
    });
  }

  // ===== LEVEL 0: CACHE MANAGEMENT OPERATIONS =====

  /**
   * Perform cache management operations with proper locking
   */
  async withCacheManagement<T>(
    context: EmptyContext,
    fn: (ctx: LockContext<Locked<'cache-mgmt'>, CacheLevel>) => Promise<T>
  ): Promise<T> {
    return await this.cacheManagementLock.acquire(context, fn);
  }

  // ===== LEVEL 1: WORLD OPERATIONS =====

  /**
   * Perform world read operations with proper locking
   */
  async withWorldRead<T>(
    context: LockContext<any, CacheLevel | never>,
    fn: (ctx: WorldReadContext) => Promise<T>
  ): Promise<T> {
    return await this.worldLock.read(context, fn);
  }

  /**
   * Perform world write operations with proper locking
   */
  async withWorldWrite<T>(
    context: LockContext<any, CacheLevel | never>,
    fn: (ctx: WorldWriteContext) => Promise<T>
  ): Promise<T> {
    return await this.worldLock.write(context, fn);
  }

  /**
   * Get world data without acquiring locks (requires world lock context)
   */
  getWorldUnsafe(_context: WorldAccessContext): World {
    if (!this.world) {
      throw new Error('World not loaded - call initialize() first');
    }
    this.stats.worldCacheHits++;
    return this.world;
  }

  /**
   * Update world data without acquiring locks (requires world write lock context)
   */
  updateWorldUnsafe(world: World, _context: WorldAccessContext): void {
    this.world = world;
    this.worldDirty = true;
  }

  /**
   * Update ship speed without acquiring locks (requires world write lock context)
   */
  setShipSpeedUnsafe(shipId: number, speed: number, _context: WorldAccessContext): void {
    if (!this.world) {
      throw new Error('World not loaded - call initialize() first');
    }
    
    const ship = this.world.getSpaceObject(shipId);
    if (ship) {
      ship.speed = speed;
      ship.last_position_update_ms = Date.now();
      this.worldDirty = true;
    }
  }

  /**
   * Teleport ship without acquiring locks (requires world write lock context)
   */
  teleportShipUnsafe(shipId: number, x: number, y: number, _context: WorldAccessContext): void {
    if (!this.world) {
      throw new Error('World not loaded - call initialize() first');
    }
    
    const ship = this.world.getSpaceObject(shipId);
    if (ship) {
      ship.x = x;
      ship.y = y;
      ship.speed = 0;
      ship.last_position_update_ms = Date.now();
      this.worldDirty = true;
    }
  }

  /**
   * Delete space object without acquiring locks (requires world write lock context)
   */
  deleteSpaceObjectUnsafe(objectId: number, _context: WorldAccessContext): void {
    if (!this.world) {
      throw new Error('World not loaded - call initialize() first');
    }
    
    this.world.spaceObjects = this.world.spaceObjects.filter(obj => obj.id !== objectId);
    this.worldDirty = true;
  }

  /**
   * Insert space object without acquiring locks (requires world write lock context)
   * Returns the new object's ID (will be assigned after DB insert)
   */
  insertSpaceObjectUnsafe(obj: Omit<SpaceObject, 'id'>, _context: WorldAccessContext): void {
    if (!this.world) {
      throw new Error('World not loaded - call initialize() first');
    }
    
    // Note: ID will be assigned by database, so we use a temporary negative ID
    // The caller should refresh from DB after insert to get the real ID
    const tempObj = { ...obj, id: -1 };
    this.world.spaceObjects.push(tempObj as SpaceObject);
    this.worldDirty = true;
  }

  // ===== LEVEL 2: USER OPERATIONS =====

  /**
   * Perform user operations with proper locking (single lock for ALL users)
   */
  async withUserLock<T>(
    context: LockContext<any, CacheLevel | WorldLevel | never>,
    fn: (ctx: UserContext) => Promise<T>
  ): Promise<T> {
    return await this.userLock.acquire(context, fn);
  }

  /**
   * Get user data without acquiring locks (requires user lock context)
   */
  getUserUnsafe(userId: number, _context: UserAccessContext): User | null {
    const user = this.users.get(userId);
    if (user) {
      this.stats.userCacheHits++;
      return user;
    } else {
      this.stats.userCacheMisses++;
      return null;
    }
  }

  /**
   * Set user data without acquiring locks (requires user lock context)
   */
  setUserUnsafe(user: User, _context: UserAccessContext): void {
    this.users.set(user.id, user);
    this.usernameToUserId.set(user.username, user.id); // Cache username mapping
    this.dirtyUsers.delete(user.id); // Fresh from DB, not dirty
    console.log(`👤 User ${user.id} cached in memory`);
  }

  /**
   * Update user data without acquiring locks (requires user lock context)
   */
  updateUserUnsafe(user: User, _context: UserAccessContext): void {
    this.users.set(user.id, user);
    this.usernameToUserId.set(user.username, user.id); // Update username mapping
    this.dirtyUsers.add(user.id); // Mark as dirty for persistence
  }

  /**
   * Update user battle state without acquiring locks (requires user lock context)
   */
  setUserBattleStateUnsafe(userId: number, inBattle: boolean, battleId: number | null, _context: UserAccessContext): void {
    const user = this.users.get(userId);
    if (user) {
      user.inBattle = inBattle;
      user.currentBattleId = battleId;
      this.dirtyUsers.add(userId);
    }
  }

  /**
   * Update user defense values without acquiring locks (requires user lock context)
   */
  setUserDefenseUnsafe(
    userId: number,
    hull: number,
    armor: number,
    shield: number,
    _context: UserAccessContext
  ): void {
    const user = this.users.get(userId);
    if (user) {
      user.hullCurrent = hull;
      user.armorCurrent = armor;
      user.shieldCurrent = shield;
      user.defenseLastRegen = Math.floor(Date.now() / 1000);
      this.dirtyUsers.add(userId);
    }
  }

  // ===== LEVEL 3: DATABASE OPERATIONS =====

  /**
   * Perform database read operations with proper locking
   */
  async withDatabaseRead<T>(
    context: LockContext<any, CacheLevel | WorldLevel | UserLevel | BattleLevel | never>,
    fn: (ctx: DatabaseReadContext) => Promise<T>
  ): Promise<T> {
    return await this.databaseLock.read(context, fn);
  }

  /**
   * Perform database write operations with proper locking
   */
  async withDatabaseWrite<T>(
    context: LockContext<any, CacheLevel | WorldLevel | UserLevel | BattleLevel | never>,
    fn: (ctx: DatabaseWriteContext) => Promise<T>
  ): Promise<T> {
    return await this.databaseLock.write(context, fn);
  }

  /**
   * Load user from database without acquiring locks (requires database read lock context)
   */
  async loadUserFromDbUnsafe(userId: number, _context: DatabaseAccessContext): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    return await getUserByIdFromDb(this.db, userId, async () => {});
  }

  /**
   * Load user by username from database without acquiring locks (requires database read lock context)
   */
  async loadUserByUsernameFromDbUnsafe(username: string, _context: DatabaseAccessContext): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    return await getUserByUsernameFromDb(this.db, username, async () => {});
  }

  // ===== HIGH-LEVEL OPERATIONS WITH PROPER LOCK ORDERING =====

  /**
   * Load user from database if not in cache (proper lock ordering)
   * @param context Lock context from caller (REQUIRED - no default)
   */
  async loadUserIfNeeded(
    userId: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: LockContext<any, any>
  ): Promise<User | null> {
    return await this.withUserLock(context, async (userCtx: UserContext) => {
      let user = this.getUserUnsafe(userId, userCtx);
      if (user) {
        return user;
      }

      // Load from database
      return await this.withDatabaseRead(userCtx, async (dbCtx: DatabaseReadContext) => {
        console.log(`🔄 User ${userId} cache miss, loading from database...`);
        user = await this.loadUserFromDbUnsafe(userId, dbCtx);
        if (user) {
          this.setUserUnsafe(user, userCtx);
        }
        return user;
      });
    });
  }

  /**
   * Get user by username (with caching)
   * @param context Lock context from caller (REQUIRED - no default)
   */
  async getUserByUsername(
    username: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: LockContext<any, any>
  ): Promise<User | null> {
    return await this.withUserLock(context, async (userCtx: UserContext) => {
      // Check username cache first
      const cachedUserId = this.usernameToUserId.get(username);
      if (cachedUserId) {
        const user = this.getUserUnsafe(cachedUserId, userCtx);
        if (user) {
          console.log(`👤 Username "${username}" cache hit for user ID ${cachedUserId}`);
          return user;
        }
      }
      
      // Cache miss - load from database
      console.log(`🔍 Username "${username}" cache miss, loading from database`);
      return await this.withDatabaseRead(userCtx, async (dbCtx: DatabaseReadContext) => {
        const user = await this.loadUserByUsernameFromDbUnsafe(username, dbCtx);
        if (user) {
          this.setUserUnsafe(user, userCtx);
        }
        return user;
      });
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<TypedCacheStats> {
    const emptyCtx = createEmptyContext();
    
    return await this.withUserLock(emptyCtx, async (_userCtx: UserContext) => {
      return {
        userCacheSize: this.users.size,
        usernameCacheSize: this.usernameToUserId.size,
        messageCacheSize: this.userMessages.size,
        battleCacheSize: this.battles.size,
        worldCacheHits: this.stats.worldCacheHits,
        worldCacheMisses: this.stats.worldCacheMisses,
        userCacheHits: this.stats.userCacheHits,
        userCacheMisses: this.stats.userCacheMisses,
        messageCacheHits: this.stats.messageCacheHits,
        messageCacheMisses: this.stats.messageCacheMisses,
        battleCacheHits: this.stats.battleCacheHits,
        battleCacheMisses: this.stats.battleCacheMisses,
        dirtyUsers: this.dirtyUsers.size,
        dirtyMessages: this.dirtyMessages.size,
        dirtyBattles: this.dirtyBattles.size,
        worldDirty: this.worldDirty
      };
    });
  }

  /**
   * Force flush all dirty data to database
   * Useful for ensuring data is persisted before reading directly from DB
   */
  async flushAllToDatabase(): Promise<void> {
    const emptyCtx = createEmptyContext();
    
    console.log('🔄 Flushing all dirty data to database...');
    
    // Persist dirty users
    if (this.dirtyUsers.size > 0) {
      console.log(`💾 Flushing ${this.dirtyUsers.size} dirty user(s)`);
      await this.persistDirtyUsers(emptyCtx);
    }
    
    // Persist dirty messages
    if (this.dirtyMessages.size > 0) {
      console.log(`💾 Flushing ${this.dirtyMessages.size} dirty message user(s)`);
      await this.persistDirtyMessages(emptyCtx);
    }
    
    // Persist dirty battles
    if (this.dirtyBattles.size > 0) {
      console.log(`💾 Flushing ${this.dirtyBattles.size} dirty battle(s)`);
      await this.persistDirtyBattles(emptyCtx);
    }
    
    // Persist dirty world data
    if (this.worldDirty) {
      console.log('💾 Flushing world data');
      await this.persistDirtyWorld(emptyCtx);
    }
    
    console.log('✅ All dirty data flushed to database');
  }

  // ============================================
  // MESSAGE CACHE OPERATIONS
  // ============================================

  /**
   * Get messages for a user from cache or database (without acquiring locks)
   * UNSAFE: Requires message lock context already acquired
   */
  private async getMessagesForUserUnsafe(
    messageCtx: LockContext<any, any>,
    userId: number
  ): Promise<Message[]> {
    // Check cache first
    if (this.userMessages.has(userId)) {
      this.stats.messageCacheHits++;
      return this.userMessages.get(userId)!;
    }

    // Cache miss - load from database
    this.stats.messageCacheMisses++;
    return this.databaseLock.read(messageCtx, async () => {
      if (!this.db) throw new Error('Database not initialized');
      
      const messages = await this.loadMessagesFromDb(userId);
      this.userMessages.set(userId, messages);
      return messages;
    });
  }

  /**
   * Get messages for a user from cache or database
   */
  async getMessagesForUser<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>,
    userId: number
  ): Promise<Message[]> {
    return this.messageLock.read(context, async (messageCtx) => {
      return this.getMessagesForUserUnsafe(messageCtx, userId);
    });
  }

  /**
   * Get unread messages for a user and mark as read
   */
  async getAndMarkUnreadMessages<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>,
    userId: number
  ): Promise<UnreadMessage[]> {
    return this.messageLock.write(context, async (messageCtx) => {
      // Get all messages for user (using unsafe version to avoid deadlock)
      const allMessages = await this.getMessagesForUserUnsafe(messageCtx, userId);
      
      // Filter unread and convert to UnreadMessage format
      const unreadMessages: UnreadMessage[] = allMessages
        .filter(msg => !msg.is_read)
        .map(msg => ({
          id: msg.id,
          created_at: msg.created_at,
          message: msg.message
        }));

      // Mark as read in cache
      allMessages.forEach(msg => {
        if (!msg.is_read) {
          msg.is_read = true;
        }
      });

      // Mark user as dirty for persistence
      this.dirtyMessages.add(userId);

      return unreadMessages;
    });
  }

  /**
   * Create a new message for a user
   */
  async createMessage<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>,
    userId: number,
    messageText: string
  ): Promise<number> {
    return this.messageLock.write(context, async (messageCtx) => {
      return this.databaseLock.write(messageCtx, async () => {
        if (!this.db) throw new Error('Database not initialized');
        
        // Create message in database first to get ID
        const messageId = await this.createMessageInDb(userId, messageText);
        
        // Update cache
        const newMessage: Message = {
          id: messageId,
          recipient_id: userId,
          created_at: Math.floor(Date.now() / 1000),
          is_read: false,
          message: messageText
        };

        if (this.userMessages.has(userId)) {
          this.userMessages.get(userId)!.push(newMessage);
        } else {
          this.userMessages.set(userId, [newMessage]);
        }

        return messageId;
      });
    });
  }

  /**
   * Get count of unread messages for a user (from cache)
   */
  async getUnreadMessageCount<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>,
    userId: number
  ): Promise<number> {
    return this.messageLock.read(context, async (messageCtx) => {
      const messages = await this.getMessagesForUserUnsafe(messageCtx, userId);
      return messages.filter(msg => !msg.is_read).length;
    });
  }

  /**
   * Delete old read messages (cleanup operation)
   */
  async deleteOldReadMessages<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>,
    olderThanDays = 30
  ): Promise<number> {
    return this.messageLock.write(context, async (messageCtx) => {
      return this.databaseLock.write(messageCtx, async () => {
        if (!this.db) throw new Error('Database not initialized');
        
        const cutoffTime = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);
        const deletedCount = await this.deleteOldMessagesFromDb(cutoffTime);
        
        // Clear cache to force reload
        this.userMessages.clear();
        
        return deletedCount;
      });
    });
  }

  // ============================================
  // MESSAGE DATABASE OPERATIONS (PRIVATE)
  // ============================================

  private async loadMessagesFromDb(userId: number): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        SELECT id, recipient_id, created_at, is_read, message
        FROM messages 
        WHERE recipient_id = ?
        ORDER BY created_at DESC
      `);
      
      stmt.all(userId, (err: Error | null, rows: Message[]) => {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  private async createMessageInDb(userId: number, messageText: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const createdAt = Math.floor(Date.now() / 1000);
      const stmt = this.db!.prepare(`
        INSERT INTO messages (recipient_id, created_at, is_read, message)
        VALUES (?, ?, 0, ?)
      `);
      
      stmt.run(userId, createdAt, messageText, function(this: sqlite3.RunResult, err: Error | null) {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  private async deleteOldMessagesFromDb(cutoffTime: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        DELETE FROM messages 
        WHERE is_read = 1 AND created_at < ?
      `);
      
      stmt.run(cutoffTime, function(this: sqlite3.RunResult, err: Error | null) {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  private async persistMessagesForUser(userId: number): Promise<void> {
    const messages = this.userMessages.get(userId);
    if (!messages) return;

    // Update all messages for this user in the database
    for (const message of messages) {
      await new Promise<void>((resolve, reject) => {
        const stmt = this.db!.prepare(`
          UPDATE messages 
          SET is_read = ?
          WHERE id = ?
        `);
        
        stmt.run(message.is_read ? 1 : 0, message.id, (err: Error | null) => {
          stmt.finalize();
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * Manually persist all dirty users to database
   */
  async persistDirtyUsers<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>
  ): Promise<void> {
    await this.userLock.acquire(context, async (userCtx) => {
      await this.databaseLock.write(userCtx, async () => {
        const dirtyUserIds = Array.from(this.dirtyUsers);
        
        if (dirtyUserIds.length === 0) {
          return;
        }
        
        console.log(`💾 Persisting ${dirtyUserIds.length} dirty user(s) to database...`);
        
        for (const userId of dirtyUserIds) {
          const user = this.users.get(userId);
          if (user) {
            await this.persistUserToDb(user);
          }
        }
        
        this.dirtyUsers.clear();
        console.log('✅ Dirty users persisted to database');
      });
    });
  }

  /**
   * Persist a single user to database
   */
  private async persistUserToDb(user: User): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise<void>((resolve, reject) => {
      this.db!.run(
        `UPDATE users SET 
          iron = ?, 
          last_updated = ?, 
          tech_tree = ?, 
          ship_id = ?,
          pulse_laser = ?,
          auto_turret = ?,
          plasma_lance = ?,
          gauss_rifle = ?,
          photon_torpedo = ?,
          rocket_launcher = ?,
          ship_hull = ?,
          kinetic_armor = ?,
          energy_shield = ?,
          missile_jammer = ?,
          hull_current = ?,
          armor_current = ?,
          shield_current = ?,
          defense_last_regen = ?
        WHERE id = ?`,
        [
          user.iron, 
          user.last_updated, 
          JSON.stringify(user.techTree), 
          user.ship_id,
          user.techCounts.pulse_laser,
          user.techCounts.auto_turret,
          user.techCounts.plasma_lance,
          user.techCounts.gauss_rifle,
          user.techCounts.photon_torpedo,
          user.techCounts.rocket_launcher,
          user.techCounts.ship_hull,
          user.techCounts.kinetic_armor,
          user.techCounts.energy_shield,
          user.techCounts.missile_jammer,
          user.hullCurrent,
          user.armorCurrent,
          user.shieldCurrent,
          user.defenseLastRegen,
          user.id
        ],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Manually persist all dirty messages to database
   * TODO: Integrate with background persistence system
   */
  async persistDirtyMessages<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>
  ): Promise<void> {
    await this.messageLock.write(context, async (messageCtx) => {
      await this.databaseLock.write(messageCtx, async () => {
        const dirtyUserIds = Array.from(this.dirtyMessages);
        
        for (const userId of dirtyUserIds) {
          await this.persistMessagesForUser(userId);
        }
        
        this.dirtyMessages.clear();
      });
    });
  }

  // ============================================
  // BATTLE CACHE OPERATIONS
  // ============================================

  /**
   * Acquire battle lock for operations
   */
  async withBattleLock<T, CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>,
    fn: (ctx: LockContext<Locked<'battle'>, BattleLevel | CurrentLevel>) => Promise<T>
  ): Promise<T> {
    return await this.battleLock.acquire(context, fn);
  }

  /**
   * Get battle from cache without acquiring locks (requires battle lock context)
   * UNSAFE: Requires battle lock context already acquired
   */
  getBattleUnsafe(battleId: number, _context: BattleAccessContext): Battle | null {
    const battle = this.battles.get(battleId);
    if (battle) {
      this.stats.battleCacheHits++;
      return battle;
    }
    this.stats.battleCacheMisses++;
    return null;
  }

  /**
   * Set battle in cache without acquiring locks (requires battle lock context)
   * UNSAFE: Requires battle lock context already acquired
   */
  setBattleUnsafe(battle: Battle, _context: BattleAccessContext): void {
    this.battles.set(battle.id, battle);
    this.dirtyBattles.add(battle.id);
  }

  /**
   * Load battle from database without acquiring locks (requires database read lock context)
   */
  async loadBattleFromDbUnsafe(battleId: number, _context: DatabaseAccessContext): Promise<Battle | null> {
    if (!this.db) throw new Error('Database not initialized');
    return await BattleRepo.getBattle(battleId);
  }

  /**
   * Load battle from database if not in cache (proper lock ordering)
   * @param context Lock context from caller (REQUIRED - no default)
   */
  async loadBattleIfNeeded(
    battleId: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: LockContext<any, any>
  ): Promise<Battle | null> {
    return await this.withBattleLock(context, async (battleCtx: BattleContext) => {
      let battle = this.getBattleUnsafe(battleId, battleCtx);
      if (battle) {
        return battle;
      }

      // Load from database
      return await this.withDatabaseRead(battleCtx, async (dbCtx: DatabaseReadContext) => {
        console.log(`🔄 Battle ${battleId} cache miss, loading from database...`);
        battle = await this.loadBattleFromDbUnsafe(battleId, dbCtx);
        if (battle) {
          this.setBattleUnsafe(battle, battleCtx);
        }
        return battle;
      });
    });
  }

  /**
   * Persist a single battle to database
   */
  private async persistBattleToDb(battle: Battle): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE battles 
        SET attacker_weapon_cooldowns = ?,
            attackee_weapon_cooldowns = ?,
            attacker_start_stats = ?,
            attackee_start_stats = ?,
            attacker_end_stats = ?,
            attackee_end_stats = ?,
            battle_log = ?,
            battle_end_time = ?,
            winner_id = ?,
            loser_id = ?
        WHERE id = ?
      `;
      
      this.db!.run(
        query,
        [
          JSON.stringify(battle.attackerWeaponCooldowns),
          JSON.stringify(battle.attackeeWeaponCooldowns),
          JSON.stringify(battle.attackerStartStats),
          JSON.stringify(battle.attackeeStartStats),
          battle.attackerEndStats ? JSON.stringify(battle.attackerEndStats) : null,
          battle.attackeeEndStats ? JSON.stringify(battle.attackeeEndStats) : null,
          JSON.stringify(battle.battleLog),
          battle.battleEndTime,
          battle.winnerId,
          battle.loserId,
          battle.id
        ],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Manually persist all dirty battles to database
   */
  async persistDirtyBattles<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>
  ): Promise<void> {
    await this.battleLock.acquire(context, async (battleCtx) => {
      await this.databaseLock.write(battleCtx, async () => {
        const dirtyBattleIds = Array.from(this.dirtyBattles);
        
        for (const battleId of dirtyBattleIds) {
          const battle = this.battles.get(battleId);
          if (battle) {
            await this.persistBattleToDb(battle);
          }
        }
        
        this.dirtyBattles.clear();
      });
    });
  }

  /**
   * Manually persist dirty world data to database
   */
  async persistDirtyWorld<CurrentLevel extends number>(
    context: LockContext<any, CurrentLevel>
  ): Promise<void> {
    await this.worldLock.write(context, async (worldCtx) => {
      if (!this.worldDirty || !this.world) {
        return; // Nothing to persist
      }

      await this.databaseLock.write(worldCtx, async () => {
        if (!this.db) throw new Error('Database not initialized');
        
        console.log('💾 Persisting world data to database...');
        const saveCallback = saveWorldToDb(this.db);
        await saveCallback(this.world!);
        
        this.worldDirty = false;
        console.log('✅ World data persisted to database');
      });
    });
  }

  /**
   * Start background persistence timer
   */
  private startBackgroundPersistence(): void {
    if (!this.config.enableAutoPersistence) {
      console.log('📝 Background persistence disabled by config');
      return;
    }

    console.log(`📝 Starting background persistence (interval: ${this.config.persistenceIntervalMs}ms)`);
    
    this.persistenceTimer = setInterval(async () => {
      try {
        await this.backgroundPersist();
      } catch (error) {
        console.error('❌ Background persistence error:', error);
      }
    }, this.config.persistenceIntervalMs);
  }

  /**
   * Stop background persistence timer
   */
  private stopBackgroundPersistence(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
      console.log('⏹️ Background persistence stopped');
    }
  }

  /**
   * Start battle scheduler
   */
  private startBattleScheduler(): void {
    // Import dynamically to avoid circular dependencies
    import('./battleScheduler').then(({ startBattleScheduler }) => {
      startBattleScheduler(1000); // Process battles every 1 second
    }).catch(error => {
      console.error('❌ Failed to start battle scheduler:', error);
    });
  }

  /**
   * Background persistence operation
   */
  private async backgroundPersist(): Promise<void> {
    const emptyCtx = createEmptyContext();
    
    // Persist dirty users
    if (this.dirtyUsers.size > 0) {
      console.log(`💾 Background persisting ${this.dirtyUsers.size} dirty user(s)`);
      await this.persistDirtyUsers(emptyCtx);
    }

    // Persist dirty messages
    if (this.dirtyMessages.size > 0) {
      console.log(`💾 Background persisting ${this.dirtyMessages.size} dirty message user(s)`);
      await this.persistDirtyMessages(emptyCtx);
    }

    // Persist dirty battles
    if (this.dirtyBattles.size > 0) {
      console.log(`💾 Background persisting ${this.dirtyBattles.size} dirty battle(s)`);
      await this.persistDirtyBattles(emptyCtx);
    }

    // Persist dirty world data
    if (this.worldDirty) {
      console.log('💾 Background persisting world data...');
      await this.persistDirtyWorld(emptyCtx);
    }
  }

  /**
   * Shutdown the cache manager
   */
  async shutdown(): Promise<void> {
    const emptyCtx = createEmptyContext();
    
    await this.withCacheManagement(emptyCtx, async () => {
      console.log('🔄 Shutting down typed cache manager...');
      
      // Stop background persistence
      this.stopBackgroundPersistence();
      
      // Final persist of any dirty data
      if (this.dirtyUsers.size > 0) {
        console.log('💾 Final persist of dirty users before shutdown');
        await this.persistDirtyUsers(emptyCtx);
      }
      
      if (this.dirtyMessages.size > 0) {
        console.log('💾 Final persist of dirty messages before shutdown');
        await this.persistDirtyMessages(emptyCtx);
      }
      
      if (this.dirtyBattles.size > 0) {
        console.log('💾 Final persist of dirty battles before shutdown');
        await this.persistDirtyBattles(emptyCtx);
      }
      
      // Final persist of dirty world data before shutdown
      if (this.worldDirty) {
        console.log('💾 Final persist of world data before shutdown');
        await this.persistDirtyWorld(emptyCtx);
      }
      
      this.isInitialized = false;
      console.log('✅ Typed cache manager shutdown complete');
    });
  }
}

// Convenience function to get singleton instance
export function getTypedCacheManager(config?: TypedCacheConfig): TypedCacheManager {
  return TypedCacheManager.getInstance(config);
}

// Convenience functions for message operations
/**
 * Send a message to a user (cached)
 * @param context Lock context from caller (REQUIRED - no default)
 */
export async function sendMessageToUserCached(
  userId: number,
  message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: LockContext<any, any>
): Promise<number> {
  const cacheManager = getTypedCacheManager();
  
  // Auto-initialize if not already done (handles test scenarios)
  if (!cacheManager.isReady) {
    await cacheManager.initialize();
  }
  
  return await cacheManager.createMessage(context, userId, message);
}

/**
 * Get and mark messages as read for a user (cached)
 * @param context Lock context from caller (REQUIRED - no default)
 */
export async function getUserMessagesCached(
  userId: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: LockContext<any, any>
): Promise<UnreadMessage[]> {
  const cacheManager = getTypedCacheManager();
  
  // Auto-initialize if not already done (handles test scenarios)
  if (!cacheManager.isReady) {
    await cacheManager.initialize();
  }
  
  return await cacheManager.getAndMarkUnreadMessages(context, userId);
}

/**
 * Get unread message count for a user (cached)
 * @param context Lock context from caller (REQUIRED - no default)
 */
export async function getUserMessageCountCached(
  userId: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: LockContext<any, any>
): Promise<number> {
  const cacheManager = getTypedCacheManager();
  
  // Auto-initialize if not already done (handles test scenarios)
  if (!cacheManager.isReady) {
    await cacheManager.initialize();
  }
  
  return await cacheManager.getUnreadMessageCount(context, userId);
}
