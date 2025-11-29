export async function register() {

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Server-side initialization code here
        
        // need to dynamically import to avoid issues with sqlite3 in edge runtime
        const { initializeServer } = await import("./lib/server/main");
        await initializeServer();
    }
}