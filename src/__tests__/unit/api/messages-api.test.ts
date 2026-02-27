import { describe, test, expect } from 'vitest';
import { GET } from '@/app/api/messages/route';
import { POST } from '@/app/api/messages/mark-read/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('Messages API Route Handler', () => {
  test('messages_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/messages', 'GET');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Not authenticated');
  });

  describe('Mark Messages as Read', () => {
    test('markRead_notAuthenticated_returns401', async () => {
      const request = createRequest('http://localhost:3000/api/messages/mark-read', 'POST');
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Not authenticated');
    });
  });
});
