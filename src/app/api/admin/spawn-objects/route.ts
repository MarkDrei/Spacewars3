// ---
// API Route for admin users to spawn space objects
// Allows spawning multiple instances of asteroids, shipwrecks, or escape pods
//
// Access restricted to developer users only ('a' and 'q')
//
// POST: Spawns specified quantity of space objects of a given type
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { createLockContext, LOCK_4, LOCK_6 } from '@markdrei/ironguard-typescript-locks';

/**
 * Request body interface for spawning objects
 */
interface SpawnObjectsRequest {
  type: 'asteroid' | 'shipwreck' | 'escape_pod';
  quantity: number;
}

/**
 * Response interface for successful spawn
 */
interface SpawnObjectsResponse {
  success: true;
  spawned: number;
  ids: number[];
}

/**
 * Validates the spawn objects request body
 * 
 * @param body - Unknown request body to validate
 * @returns Validated and typed request object
 * @throws ApiError(400) if validation fails
 */
function validateSpawnRequest(body: unknown): SpawnObjectsRequest {
  // Check that body is an object
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'Invalid request: body must be an object');
  }

  const { type, quantity } = body as Record<string, unknown>;

  // Validate type field
  if (typeof type !== 'string') {
    throw new ApiError(400, 'Invalid request: type must be a string');
  }
  if (type !== 'asteroid' && type !== 'shipwreck' && type !== 'escape_pod') {
    throw new ApiError(400, `Invalid request: type must be one of 'asteroid', 'shipwreck', or 'escape_pod', got '${type}'`);
  }

  // Validate quantity field
  if (typeof quantity !== 'number') {
    throw new ApiError(400, 'Invalid request: quantity must be a number');
  }
  if (!Number.isInteger(quantity)) {
    throw new ApiError(400, 'Invalid request: quantity must be an integer');
  }
  if (quantity < 1) {
    throw new ApiError(400, 'Invalid request: quantity must be at least 1');
  }
  if (quantity > 50) {
    throw new ApiError(400, 'Invalid request: quantity cannot exceed 50 (max limit)');
  }

  return { type, quantity };
}

/**
 * POST /api/admin/spawn-objects
 * 
 * Spawns the specified quantity of space objects of the given type.
 * Each object is spawned with randomized position, speed (±25% variation),
 * and angle within the world bounds.
 * 
 * Request body:
 * - type: 'asteroid' | 'shipwreck' | 'escape_pod' (required)
 * - quantity: number (required, 1-50)
 * 
 * Response:
 * - success: true
 * - spawned: number (count of objects spawned)
 * - ids: number[] (array of spawned object IDs)
 * 
 * @requires Authentication (session with userId)
 * @requires Admin privileges (username 'a' or 'q')
 * 
 * @returns 200 - Success response with spawned object details
 * @returns 400 - Invalid request body
 * @returns 401 - Not authenticated
 * @returns 403 - Not authorized (non-admin user)
 * @returns 404 - User not found
 */
export async function POST(request: NextRequest) {
  try {
    // Get session and validate authentication
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    // Parse and validate request body
    const body = await request.json();
    const validatedRequest = validateSpawnRequest(body);

    // Get user data to check admin privileges and spawn objects with proper locking
    const emptyCtx = createLockContext();
    const userCache = UserCache.getInstance2();
    
    return await emptyCtx.useLockWithAcquire(LOCK_4, async (userContext) => {
      const userData = await userCache.getUserByIdWithLock(userContext, session.userId!);
      if (!userData) {
        throw new ApiError(404, 'User not found');
      }

      // Check admin privileges (developer-only access)
      if (userData.username !== 'a' && userData.username !== 'q') {
        throw new ApiError(403, 'Admin access restricted to developers');
      }

      // Acquire world lock and spawn objects
      return await userContext.useLockWithAcquire(LOCK_6, async (worldContext) => {
        const worldCache = WorldCache.getInstance();
        const world = worldCache.getWorldFromCache(worldContext);

        // Spawn the requested quantity of objects
        const spawnedIds: number[] = [];
        for (let i = 0; i < validatedRequest.quantity; i++) {
          const newId = await world.spawnSpecificObject(worldContext, validatedRequest.type);
          spawnedIds.push(newId);
        }

        // Update world cache to persist changes
        await worldCache.updateWorldUnsafe(worldContext, world);

        const response: SpawnObjectsResponse = {
          success: true,
          spawned: spawnedIds.length,
          ids: spawnedIds,
        };

        console.log(`Admin ${userData.username} spawned ${response.spawned} ${validatedRequest.type}(s), IDs: [${spawnedIds.join(', ')}]`);

        return NextResponse.json(response);
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
