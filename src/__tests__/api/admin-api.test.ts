import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/admin/database/route';
import { POST as registerPOST } from '@/app/api/register/route';
import { POST as loginPOST } from '@/app/api/login/route';
import { createRequest, createAuthenticatedSession, createUser, extractSessionCookie } from '../helpers/apiTestHelpers';

describe('Admin Database API', () => {
  it('admin_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/admin/database', 'GET');
    const response = await GET(request);

    if (!response) {
      throw new Error('No response from admin database API');
    }
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Not authenticated');
  });

  it('admin_unauthorizedUser_returns403', async () => {
    // Create a user with regular username (not 'a' or 'q')
    await createUser('normaluser');
    const sessionCookie = await createAuthenticatedSession('normaluser');
    const request = createRequest('http://localhost:3000/api/admin/database', 'GET', undefined, sessionCookie);
    
    const response = await GET(request);

    if (!response) {
      throw new Error('No response from admin database API');
    }
    
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Admin access restricted to developers');
  });

  it('admin_userA_hasAccess', async () => {
    // Use seeded user 'a' from test database (password 'a')
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', { 
      username: 'a', 
      password: 'a'  // Seeded test user credentials
    });
    const loginResponse = await loginPOST(loginRequest);
    const sessionCookie = extractSessionCookie(loginResponse);
    
    if (!sessionCookie) {
      throw new Error('Failed to get session cookie');
    }
    
    const request = createRequest('http://localhost:3000/api/admin/database', 'GET', undefined, sessionCookie);
    const response = await GET(request);

    if (!response) {
      throw new Error('No response from admin database API');
    }
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('users');
    expect(data).toHaveProperty('spaceObjects');
    expect(data).toHaveProperty('totalUsers');
    expect(data).toHaveProperty('totalObjects');
    expect(data).toHaveProperty('timestamp');
    
    expect(Array.isArray(data.users)).toBe(true);
    expect(Array.isArray(data.spaceObjects)).toBe(true);
    expect(typeof data.totalUsers).toBe('number');
    expect(typeof data.totalObjects).toBe('number');
    
    // Should have at least the seeded user
    expect(data.users.length).toBeGreaterThan(0);
    expect(data.totalUsers).toBeGreaterThan(0);
    
    // Check that user 'a' exists and has expected properties
    const user = data.users.find((u: { username: string }) => u.username === 'a');
    expect(user).toBeDefined();
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('username');
    expect(user).toHaveProperty('iron');
    expect(user).toHaveProperty('pulse_laser');
    expect(user).toHaveProperty('last_updated');
  });

  it('admin_userQ_hasAccess', async () => {
    // Create user with exact username 'q' (admin access)  
    const { password } = await createUser();
    
    // Register the user with exact username 'q'
    const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', { 
      username: 'q', 
      password 
    });
    await registerPOST(registerRequest);
    
    // Login with exact username 'q'
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', { 
      username: 'q', 
      password 
    });
    const loginResponse = await loginPOST(loginRequest);
    const sessionCookie = extractSessionCookie(loginResponse);
    
    if (!sessionCookie) {
      throw new Error('Failed to get session cookie');
    }
    
    const request = createRequest('http://localhost:3000/api/admin/database', 'GET', undefined, sessionCookie);
    const response = await GET(request);
    
    if (!response) {
      throw new Error('No response from admin database API');
    }

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('users');
    expect(data).toHaveProperty('spaceObjects');
    
    // Find the 'q' user
    const user = data.users.find((u: { username: string }) => u.username === 'q');
    expect(user).toBeDefined();
  });
});