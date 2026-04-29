import { ApiError } from '@/lib/server/errors';

/**
 * Validates a username for new player registration.
 *
 * Rules:
 *   - 1–20 characters
 *   - Only alphanumeric characters, hyphens, and underscores
 *   - No spaces
 *   - No SQL injection patterns
 *   - No HTML/script injection patterns
 *   - No reserved NPC name patterns (e.g. [L1-NPC] or Level 1 NPC)
 *
 * @throws ApiError(400, …) when the username violates any rule.
 */
export function validateUsername(username: string): void {
  if (username.length < 1) {
    throw new ApiError(400, 'Username must be at least 1 character');
  }

  if (username.length > 20) {
    throw new ApiError(400, 'Username must be 20 characters or fewer');
  }

  if (/\s/.test(username)) {
    throw new ApiError(400, 'Username must not contain spaces');
  }

  // Reserved NPC patterns — check before the character allowlist so that these
  // patterns produce the most informative error message.
  if (/^\[L\d+-NPC\]$/.test(username) || /^Level\s+\d+\s+NPC$/i.test(username)) {
    throw new ApiError(400, 'Username is reserved and cannot be used');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw new ApiError(400, 'Username may only contain letters, digits, hyphens, and underscores');
  }

  // SQL injection patterns — these characters are blocked by the alphanumeric regex above,
  // but keep an explicit guard for clarity and defence-in-depth.
  if (/['"`;\\]/.test(username) || /--/.test(username) || /\/\*/.test(username)) {
    throw new ApiError(400, 'Username contains invalid characters');
  }

  // HTML/script injection patterns
  if (/<|>|&/.test(username)) {
    throw new ApiError(400, 'Username contains invalid characters');
  }
}
