import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, handleApiError } from '@/lib/server/errors';

describe('handleApiError — logging', () => {
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorLog.mockRestore();
  });

  it.each([
    ['401 of a logged-out client', new ApiError(401, 'Not authenticated')],
    ['400 validation error', new ApiError(400, 'Missing or invalid username')],
    ['429 of the rate limiter', new ApiError(429, 'Too many attempts', 'RATE_LIMITED', 60)],
    ['malformed JSON body', new SyntaxError('Unexpected token } in JSON at position 1')],
  ])('handleApiError_%s_doesNotLog', (_name, error) => {
    const response = handleApiError(error);

    expect(response.status).toBeLessThan(500);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('handleApiError_unexpectedError_logsItAndReturns500', () => {
    const error = new Error('connection refused');

    const response = handleApiError(error);

    expect(response.status).toBe(500);
    expect(errorLog).toHaveBeenCalledWith('API Error:', error);
  });

  it('handleApiError_apiErrorWithServerStatus_logsIt', () => {
    const error = new ApiError(500, 'Failed to send email');

    const response = handleApiError(error);

    expect(response.status).toBe(500);
    expect(errorLog).toHaveBeenCalledWith('API Error:', error);
  });

  it('handleApiError_nonErrorValue_logsItAndReturns500', () => {
    const response = handleApiError('some string error');

    expect(response.status).toBe(500);
    expect(errorLog).toHaveBeenCalledWith('API Error:', 'some string error');
  });
});
