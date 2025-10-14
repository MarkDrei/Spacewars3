import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getIronSession } from 'iron-session';
import { getDatabase } from '@/lib/server/database';
import { getUserByUsername } from '@/lib/server/userRepo';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, validateRequired, ApiError } from '@/lib/server/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;
    
    validateRequired(username, 'username');
    validateRequired(password, 'password');
    
    const db = await getDatabase();
    
    // Import lock context utilities
    const { createEmptyContext } = await import('@/lib/server/typedLocks');
    const emptyCtx = createEmptyContext();
    
    const user = await getUserByUsername(db, username, emptyCtx);
    
    if (!user) {
      throw new ApiError(400, 'Invalid credentials');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      throw new ApiError(400, 'Invalid credentials');
    }
    
    const now = Math.floor(Date.now() / 1000);
    user.updateStats(now);
    await user.save();
    
    // Create response
    const response = NextResponse.json({ success: true });
    
    // Set session with the response object
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = user.id;
    await session.save();
    
    console.log(`🔐 Login - Setting session userId: ${user.id} for user: ${username}`);
    
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
