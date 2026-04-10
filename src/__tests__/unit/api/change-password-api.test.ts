import { describe, expect, test } from 'vitest';
import { POST as changePasswordPOST } from '@/app/api/change-password/route';
import { createMockSessionCookie, createRequest } from '../../helpers/apiTestHelpers';

describe('Change password API', () => {
  test('changePassword_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/change-password', 'POST', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });
    const response = await changePasswordPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('changePassword_newPasswordsDoNotMatch_returns400', async () => {
    const sessionCookie = await createMockSessionCookie();
    const request = createRequest(
      'http://localhost:3000/api/change-password',
      'POST',
      {
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'different-password',
      },
      sessionCookie
    );
    const response = await changePasswordPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('New passwords do not match');
  });
});
