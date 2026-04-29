import { describe, expect, test, beforeEach, afterEach } from 'vitest';

// Import API routes directly (for now we'll use the real database)
import { POST as registerPOST } from '@/app/api/register/route';
import { POST as loginPOST } from '@/app/api/login/route';
import { POST as changePasswordPOST } from '@/app/api/change-password/route';

// Import shared test helpers
import { createAuthenticatedSessionWithUser, createRequest, randomUsername } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';

describe('Auth API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('register_newUser_success', async () => {
    await withTransaction(async () => {
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
  });

  test('register_duplicateUser_returnsUsernameTaken', async () => {
    await withTransaction(async () => {
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
      expect(data.error).toBe('Username already taken');
    });
  });

  test('login_validCredentials_success', async () => {
    await withTransaction(async () => {
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
  });

  test('login_wrongPassword_returnsInvalidCredentials', async () => {
    await withTransaction(async () => {
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

  test('login_success_setsNextLocaleCookie', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      const password = 'testpass123';

      // Register (default locale — no Accept-Language header → 'en')
      const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password,
      });
      await registerPOST(registerRequest);

      // Login
      const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
        username,
        password,
      });
      const response = await loginPOST(loginRequest);

      expect(response.status).toBe(200);
      const setCookieHeader = response.headers.get('Set-Cookie') ?? '';
      expect(setCookieHeader).toContain('NEXT_LOCALE=en');
    });
  });

  test('register_withAcceptLanguageDe_setsNextLocaleCookieDe', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      const registerRequest = createRequest(
        'http://localhost:3000/api/register',
        'POST',
        { username, password: 'testpass123' },
        undefined,
        { 'accept-language': 'de-DE,de;q=0.9,en;q=0.8' }
      );
      const response = await registerPOST(registerRequest);

      expect(response.status).toBe(200);
      const setCookieHeader = response.headers.get('Set-Cookie') ?? '';
      expect(setCookieHeader).toContain('NEXT_LOCALE=de');
    });
  });

  test('register_withoutAcceptLanguage_defaultsToEnglishLocale', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass123',
      });
      const response = await registerPOST(registerRequest);

      expect(response.status).toBe(200);
      const setCookieHeader = response.headers.get('Set-Cookie') ?? '';
      expect(setCookieHeader).toContain('NEXT_LOCALE=en');
    });
  });

  test('changePassword_validRequest_updatesStoredPassword', async () => {
    await withTransaction(async () => {
      const oldPassword = 'testpass123';
      const newPassword = 'mypassword';
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('change_password');

      const changePasswordRequest = createRequest(
        'http://localhost:3000/api/change-password',
        'POST',
        {
          currentPassword: oldPassword,
          newPassword,
          confirmPassword: newPassword,
        },
        sessionCookie!
      );
      const changePasswordResponse = await changePasswordPOST(changePasswordRequest);
      const changePasswordData = await changePasswordResponse.json();

      expect(changePasswordResponse.status).toBe(200);
      expect(changePasswordData.success).toBe(true);

      const oldPasswordLoginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
        username,
        password: oldPassword,
      });
      const oldPasswordLoginResponse = await loginPOST(oldPasswordLoginRequest);
      const oldPasswordLoginData = await oldPasswordLoginResponse.json();

      expect(oldPasswordLoginResponse.status).toBe(400);
      expect(oldPasswordLoginData.error).toBe('Invalid credentials');

      const newPasswordLoginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
        username,
        password: newPassword,
      });
      const newPasswordLoginResponse = await loginPOST(newPasswordLoginRequest);
      const newPasswordLoginData = await newPasswordLoginResponse.json();

      expect(newPasswordLoginResponse.status).toBe(200);
      expect(newPasswordLoginData.success).toBe(true);
    });
  });
});
