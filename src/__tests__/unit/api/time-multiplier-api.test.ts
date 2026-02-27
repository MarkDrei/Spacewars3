import { describe, it, expect } from 'vitest';
import { GET, POST } from '@/app/api/admin/time-multiplier/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('Admin Time Multiplier API', () => {
  describe('GET /api/admin/time-multiplier', () => {
    it('GET_unauthenticated_returns401', async () => {
      const request = createRequest('http://localhost:3000/api/admin/time-multiplier', 'GET');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Not authenticated');
    });
  });

  describe('POST /api/admin/time-multiplier', () => {
    it('POST_unauthenticated_returns401', async () => {
      const request = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
        multiplier: 10,
        durationMinutes: 5
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Not authenticated');
    });
  });
});
