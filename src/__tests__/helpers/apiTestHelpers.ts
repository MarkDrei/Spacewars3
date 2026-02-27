import { NextRequest } from 'next/server';
import { expect } from 'vitest';
import { sealData } from 'iron-session';
import { sessionOptions } from '@/lib/server/session';

// Import API routes
import { POST as registerPOST } from '@/app/api/register/route';
import { POST as loginPOST } from '@/app/api/login/route';

/**
 * Helper function to create a Next.js request for testing
 */
export function createRequest(
  url: string, 
  method: string, 
  body?: unknown, 
  sessionCookie?: string
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  
  if (sessionCookie) {
    headers['cookie'] = sessionCookie;
  }

  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers,
  });
}

/**
 * Helper to extract session cookie from response
 */
export function extractSessionCookie(response: Response): string | null {
  const setCookie = response.headers.get('Set-Cookie');
  if (setCookie) {
    const match = setCookie.match(/spacewars-session=([^;]+)/);
    return match ? `spacewars-session=${match[1]}` : null;
  }
  return null;
}

/**
 * Helper to generate unique usernames for tests
 */
export function randomUsername(prefix: string = 'testuser'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper to create an authenticated session for testing
 * Returns the session cookie that can be used in subsequent requests
 */
export async function createAuthenticatedSession(usernamePrefix?: string): Promise<string> {
  const username = randomUsername(usernamePrefix);
  const password = 'testpass123';
  
  // Register user
  const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
    username,
    password
  });
  const registerResponse = await registerPOST(registerRequest);
  expect(registerResponse.status).toBe(200);
  
  // Login user
  const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
    username,
    password
  });
  const loginResponse = await loginPOST(loginRequest);
  expect(loginResponse.status).toBe(200);
  
  // Extract session cookie
  const sessionCookie = extractSessionCookie(loginResponse);
  expect(sessionCookie).toBeTruthy();
  
  return sessionCookie!;
}

/**
 * Helper to create an authenticated session with username info
 * Returns both the session cookie and username
 */
export async function createAuthenticatedSessionWithUser(usernamePrefix?: string): Promise<{ sessionCookie: string; username: string }> {
  const username = randomUsername(usernamePrefix);
  const password = 'testpass123';
  
  // Register user
  const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
    username,
    password
  });
  const registerResponse = await registerPOST(registerRequest);
  expect(registerResponse.status).toBe(200);
  
  // Login user
  const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
    username,
    password
  });
  const loginResponse = await loginPOST(loginRequest);
  expect(loginResponse.status).toBe(200);
  
  // Extract session cookie
  const sessionCookie = extractSessionCookie(loginResponse);
  expect(sessionCookie).toBeTruthy();
  
  return { sessionCookie: sessionCookie!, username };
}

/**
 * Creates a valid iron-session cookie without any database interaction.
 *
 * Use this in unit/ui tests that need an authenticated request but do NOT care
 * about the actual user record (e.g. input-validation or auth-guard tests that
 * return 400/401/403 before ever touching a cache or the DB).
 *
 * @param userId - The user id to embed in the session (defaults to 1, the seeded
 *                 user 'a' that always exists in both dev and test databases).
 */
export async function createMockSessionCookie(userId: number = 1): Promise<string> {
  // sessionOptions.password is always a plain string in this project (see src/lib/server/session.ts)
  const password = sessionOptions.password as string;
  const ttl = (sessionOptions.cookieOptions?.maxAge as number | undefined) ?? 86400;
  const sealed = await sealData({ userId }, { password, ttl });
  return `spacewars-session=${sealed}`;
}

/**
 * Helper to create a user without logging in
 * Returns the username and password for manual login if needed
 */
export async function createUser(usernamePrefix?: string): Promise<{ username: string; password: string }> {
  const username = randomUsername(usernamePrefix);
  const password = 'testpass123';
  
  // Register user
  const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
    username,
    password
  });
  const registerResponse = await registerPOST(registerRequest);
  expect(registerResponse.status).toBe(200);
  
  return { username, password };
}
