import { describe, expect, test, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Import API routes directly (for now we'll use the real database)
import { POST as registerPOST } from '@/app/api/register/route';
import { POST as loginPOST } from '@/app/api/login/route';

// Helper function to create a Next.js request
function createRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
    },
  });
}

// Helper to generate unique usernames for tests
function randomUsername(): string {
  return `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

describe('Auth API', () => {
  test('register_newUser_success', async () => {
    const username = randomUsername();
    const request = createRequest('http://localhost:3000/api/register', 'POST', {
      username,
      password: 'testpass'
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  test('register_duplicateUser_returnsUsernameTaken', async () => {
    const username = randomUsername();
    
    // Create first user
    const request1 = createRequest('http://localhost:3000/api/register', 'POST', {
      username,
      password: 'pass1'
    });
    await registerPOST(request1);

    // Try to create duplicate user
    const request2 = createRequest('http://localhost:3000/api/register', 'POST', {
      username,
      password: 'pass2'
    });
    const response = await registerPOST(request2);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Username taken');
  });

  test('login_validCredentials_success', async () => {
    const username = randomUsername();
    
    // First register a user
    const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
      username,
      password: 'mypassword'
    });
    await registerPOST(registerRequest);

    // Then try to login
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
      username,
      password: 'mypassword'
    });
    const response = await loginPOST(loginRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  test('login_wrongPassword_returnsInvalidCredentials', async () => {
    const username = randomUsername();
    
    // First register a user
    const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
      username,
      password: 'right'
    });
    await registerPOST(registerRequest);

    // Try to login with wrong password
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
      username,
      password: 'wrong'
    });
    const response = await loginPOST(loginRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid credentials');
  });
});
