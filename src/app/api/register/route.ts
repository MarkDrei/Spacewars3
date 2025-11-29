import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getIronSession } from 'iron-session';
import { getDatabase } from '@/lib/server/database';
import { createUser, saveUserToDb } from '@/lib/server/user/userRepo';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, validateRequired } from '@/lib/server/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;
    
    validateRequired(username, 'username');
    validateRequired(password, 'password');
    
    const db = await getDatabase();
    
    // Hash password with automatic salt generation
    const hash = await bcrypt.hash(password, 10);
    
    const user = await createUser(db, username, hash, saveUserToDb(db));
    
    // Create response
    const response = NextResponse.json({ success: true });
    
    // Set session with the response object
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = user.id;
    await session.save();
    
    console.log(`🔐 Register - Setting session userId: ${user.id} for user: ${username}`);
    
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
