import { LockContext, LocksAtMostAndHas4, createLockContext } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '../user/userCache';
import { User } from '../user/user';
import { TechFactory, TechCounts, BuildQueueItem } from './TechFactory';
import { DefenseValues } from '@/shared/defenseValues';
import { MessageCache } from '../messages/MessageCache';
import { TechTree, ResearchType, getResearchEffectFromTree } from './techtree';
import { TimeMultiplierService } from '../timeMultiplier';

export class TechService {
    private static instance: TechService;
    private userCacheInstance: UserCache;
    private messageCacheInstance: MessageCache;

    private constructor() {
        this.userCacheInstance = UserCache.getInstance2();
        this.messageCacheInstance = MessageCache.getInstance();
    }

    public static getInstance(): TechService {
        if (!TechService.instance) {
            TechService.instance = new TechService();
        }
        return TechService.instance;
    }

    /**
     * Set user cache instance for testing
     */
    public setUserCacheForTesting(cache: UserCache): void {
        this.userCacheInstance = cache;
    }

    /**
     * Set message cache instance for testing
     */
    public setMessageCacheForTesting(cache: MessageCache): void {
        this.messageCacheInstance = cache;
    }

    /**
     * Get the tech counts for a user
     */
    async getTechCounts(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<TechCounts | null> {
        const user = await this.userCacheInstance.getUserByIdWithLock(context, userId);

        if (!user) return null;

        return user.techCounts;
    }

    /**
     * Get the current iron amount for a user
     */
    async getIron(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<number | null> {
        const user = await this.userCacheInstance.getUserByIdWithLock(context, userId);

        if (!user) return null;

        return user.iron;
    }

    /**
     * Get the build queue for a user with calculated completion times
     */
    async getBuildQueue(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<BuildQueueItem[] | null> {
        const user = await this.userCacheInstance.getUserByIdWithLock(context, userId);

        if (!user) return null;

        // Calculate actual completion times for each item in the queue
        const queue = user.buildQueue;
        if (queue.length === 0 || !user.buildStartSec) {
            return queue;
        }

        let cumulativeTime = user.buildStartSec;
        const multiplier = TimeMultiplierService.getInstance().getMultiplier();
        
        const queueWithTimes = queue.map(item => {
            const spec = TechFactory.getTechSpec(item.itemKey, item.itemType);
            if (!spec) {
                return { ...item, completionTime: 0 };
            }

            const buildTime = spec.buildDurationMinutes * 60;
            const effectiveBuildTime = buildTime / multiplier;
            const completionTime = cumulativeTime + effectiveBuildTime;
            cumulativeTime = completionTime; // Next item starts after this one

            return {
                ...item,
                completionTime
            };
        });

        return queueWithTimes;
    }

    /**
     * Get estimated completion time for the current build
     */
    async getEstimatedCompletionTime(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<number | null> {
        const user = await this.userCacheInstance.getUserByIdWithLock(context, userId);

        if (!user || user.buildQueue.length === 0) return null;

        // If we have a start time, calculate completion time
        if (user.buildStartSec) {
            const currentBuild = user.buildQueue[0];
            const spec = TechFactory.getTechSpec(currentBuild.itemKey, currentBuild.itemType);
            if (!spec) return null;

            const buildTime = spec.buildDurationMinutes * 60;
            return user.buildStartSec + buildTime;
        }

        return null;
    }

    /**
     * Add an item to the build queue
     */
    async addTechItemToBuildQueue(
        userId: number,
        itemKey: string,
        itemType: 'weapon' | 'defense',
        context: LockContext<LocksAtMostAndHas4>
    ): Promise<{ success: boolean; error?: string }> {
        const user = await this.userCacheInstance.getUserByIdWithLock(context, userId);

        if (!user) return { success: false, error: 'User not found' };

        // Check if item exists
        const spec = TechFactory.getTechSpec(itemKey, itemType);
        if (!spec) return { success: false, error: 'Invalid tech item' };

        // Check cost
        if (user.iron < spec.baseCost) {
            return { success: false, error: 'Insufficient iron' };
        }

        // Deduct cost using centralized method
        if (!user.subtractIron(spec.baseCost)) {
            return { success: false, error: 'Insufficient iron' };
        }

        // Add to queue
        const queueItem: BuildQueueItem = {
            itemKey,
            itemType,
            completionTime: 0 // Will be calculated when processing queue
        };

        user.buildQueue.push(queueItem);

        // If queue was empty, set start time
        if (user.buildQueue.length === 1) {
            user.buildStartSec = Math.floor(Date.now() / 1000);
        }

        this.userCacheInstance.updateUserInCache(context, user);

        return { success: true };
    }

    /**
     * Process completed builds for a user
     * This should be called periodically or when checking status
     */
    async processCompletedBuilds(userId: number, context: LockContext<LocksAtMostAndHas4>): Promise<{ completed: BuildQueueItem[] }> {
        const user = await this.userCacheInstance.getUserByIdWithLock(context, userId);

        if (!user) return { completed: [] };

        const now = Math.floor(Date.now() / 1000);
        const completedItems: BuildQueueItem[] = [];
        let queueChanged = false;

        // Process queue
        while (user.buildQueue.length > 0) {
            const currentBuild = user.buildQueue[0];

            // Ensure we have a start time
            let currentBuildStart = user.buildStartSec;
            if (currentBuildStart === null) {
                // Should not happen if queue has items, but recover by setting to now
                currentBuildStart = now;
                user.buildStartSec = currentBuildStart;
                queueChanged = true;
            }

            const spec = TechFactory.getTechSpec(currentBuild.itemKey, currentBuild.itemType);
            if (!spec) {
                // Invalid item in queue, remove it
                user.buildQueue.shift();
                user.buildStartSec = null; // Reset start time for next item (will be set below or next loop)
                queueChanged = true;
                continue;
            }

            const buildTime = spec.buildDurationMinutes * 60;
            const multiplier = TimeMultiplierService.getInstance().getMultiplier();
            const effectiveBuildTime = buildTime / multiplier;
            const calculatedCompletionTime = currentBuildStart! + effectiveBuildTime;

            // Check completion with multiplier
            if (now >= calculatedCompletionTime) {
                // Build complete!
                const levelUp = this.applyCompletedBuild(user, currentBuild);
                completedItems.push(currentBuild);

                // Remove from queue
                user.buildQueue.shift();
                queueChanged = true;

                // Send notification
                try {
                    const ctx = createLockContext();
                    await this.messageCacheInstance.createMessage(ctx, userId, `Build complete: ${spec.name}`);
                    
                    // Send level-up notification if applicable
                    if (levelUp) {
                        await this.messageCacheInstance.createMessage(
                            ctx,
                            userId,
                            `P: 🎉 Level Up! You reached level ${levelUp.newLevel}! (+${levelUp.xpReward} XP from build)`
                        );
                    }
                } catch (error) {
                    console.error(`Failed to send build completion notification to user ${userId}:`, error);
                }

                // Setup next build if any
                if (user.buildQueue.length > 0) {
                    // Next build starts at the calculated completion time of this build
                    user.buildStartSec = calculatedCompletionTime;
                } else {
                    user.buildStartSec = null;
                }
            } else {
                // Current build not finished yet
                break;
            }
        }

        if (queueChanged) {
            this.userCacheInstance.updateUserInCache(context, user);
        }

        return { completed: completedItems };
    }

    private applyCompletedBuild(user: User, build: BuildQueueItem): { leveledUp: boolean; oldLevel: number; newLevel: number; xpReward: number } | undefined {
        const itemKey = build.itemKey;

        // Update tech counts
        if (itemKey in user.techCounts) {
            (user.techCounts as unknown as Record<string, number>)[itemKey]++;
        }

        // If it's a defense item, update current values
        if (build.itemType === 'defense') {
            // Simple approach: Add the stats of the new item to current values
            // This effectively "heals" the amount the new item provides
            if (itemKey === 'ship_hull') user.hullCurrent += 100; // Example value
            if (itemKey === 'kinetic_armor') user.armorCurrent += 100;
            if (itemKey === 'energy_shield') user.shieldCurrent += 100;

            // Note: Real max values would be calculated from tech counts * base stats
        }

        // Award XP based on iron cost
        const spec = TechFactory.getTechSpec(build.itemKey, build.itemType);
        if (!spec) return undefined;

        const xpReward = Math.floor(spec.baseCost / 100);
        const levelUp = user.addXp(xpReward);

        if (levelUp) {
            return { ...levelUp, xpReward };
        }

        return undefined;
    }

    /**
     * Get detailed analysis of the user's current tech loadout
     */
    async getTechLoadoutAnalysis(
        userId: number,
        context: LockContext<LocksAtMostAndHas4>
    ) {
        const user = await this.userCacheInstance.getUserByIdWithLock(context, userId);

        if (!user) {
            throw new Error(`User ${userId} not found`);
        }

        return TechFactory.calculateTotalEffects(user.techCounts);
    }

    /**
     * Calculate max defense values including research factors
     */
    static calculateMaxDefense(techCounts: TechCounts, techTree: TechTree): { hull: number; armor: number; shield: number } {
        const stackedBase = TechFactory.calculateStackedBaseDefense(techCounts);

        // Get research factors (percentage values, e.g. 100 = 100%)
        const hullFactor = getResearchEffectFromTree(techTree, ResearchType.HullStrength) / 100;
        const armorFactor = getResearchEffectFromTree(techTree, ResearchType.ArmorEffectiveness) / 100;
        const shieldFactor = getResearchEffectFromTree(techTree, ResearchType.ShieldEffectiveness) / 100;

        return {
            hull: Math.round(stackedBase.hull * hullFactor),
            armor: Math.round(stackedBase.armor * armorFactor),
            shield: Math.round(stackedBase.shield * shieldFactor)
        };
    }

    static getDefenseStats(techCounts: TechCounts, techTree: TechTree, currentValues: { hull: number; armor: number; shield: number }): DefenseValues {
        const maxStats = this.calculateMaxDefense(techCounts, techTree);
        return {
            hull: {
                name: 'Ship Hull',
                current: currentValues.hull,
                max: maxStats.hull,
                regenRate: 1
            },
            armor: {
                name: 'Kinetic Armor',
                current: currentValues.armor,
                max: maxStats.armor,
                regenRate: 1
            },
            shield: {
                name: 'Energy Shield',
                current: currentValues.shield,
                max: maxStats.shield,
                regenRate: 1
            }
        };
    }
}
