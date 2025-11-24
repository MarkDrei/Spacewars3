// ---
// "main" is the dirty place where all the bootstrapping happens.
// ---
import { createLockContext, LOCK_1, LOCK_10, LOCK_11, LOCK_12, LOCK_13, LOCK_14, LOCK_15, LOCK_2, LOCK_3, LOCK_4, LOCK_5, LOCK_6, LOCK_7, LOCK_8, LOCK_9 } from "@markdrei/ironguard-typescript-locks";
import { getDatabase } from "./database";
import { loadWorldFromDb } from "./world/worldRepo";
import { UserCache } from "./user/userCache";
import { BattleCache } from "./battle/BattleCache";
import { MessageCache } from "./messages/MessageCache";
import { WorldCache } from "./world/worldCache";

export async function initializeServer() {

        console.log('🌱🪴 Application startup - acquiring locks');

        // acquire all 15 locks, just to be sure that no one gets in our way during startup :)
        const emptyCtx = createLockContext();
        const ctx1 = await emptyCtx.acquireWrite(LOCK_1);
        const ctx2 = await ctx1.acquireWrite(LOCK_2);
        const ctx3 = await ctx2.acquireWrite(LOCK_3);
        const ctx4 = await ctx3.acquireWrite(LOCK_4);
        const ctx5 = await ctx4.acquireWrite(LOCK_5);
        const ctx6 = await ctx5.acquireWrite(LOCK_6);
        const ctx7 = await ctx6.acquireWrite(LOCK_7);
        const ctx8 = await ctx7.acquireWrite(LOCK_8);
        const ctx9 = await ctx8.acquireWrite(LOCK_9);
        const ctx10 = await ctx9.acquireWrite(LOCK_10);
        const ctx11 = await ctx10.acquireWrite(LOCK_11);
        const ctx12 = await ctx11.acquireWrite(LOCK_12);
        const ctx13 = await ctx12.acquireWrite(LOCK_13);
        const ctx14 = await ctx13.acquireWrite(LOCK_14);
        const ctx15 = await ctx14.acquireWrite(LOCK_15);

        console.log('🌱🪴 Application startup - locks acquired');

        const db = await getDatabase();
        const world = await loadWorldFromDb(db, async () => {
            console.warn('⚠️ Save world callback invoked - but no save is happening');
        });

        await MessageCache.initialize(db);
        const messageCache = MessageCache.getInstance();

        WorldCache.configureDependencies({ messageCache });
        WorldCache.initializeWithWorld(world, db);

        await UserCache.intialize2({
            db,
            worldCache: WorldCache.getInstance(),
            messageCache
        });

        BattleCache.configureDependencies({
            userCache: UserCache.getInstance2(),
            worldCache: WorldCache.getInstance(),
            messageCache
        });

        // Initialize BattleCache
        console.log('🌱🪴 Application startup - ⚔️ Initializing BattleCache...');
        await BattleCache.initialize2(db);
        console.log('🌱🪴 Application startup - ✅ BattleCache initialized');

        console.log('🌱🪴 Application startup complete');

        ctx15.dispose(); // release all locks
}