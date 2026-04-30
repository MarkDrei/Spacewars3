import { describe, it, expect } from 'vitest';
import { validateUsername } from '@/lib/server/user/usernameValidation';
import { ApiError } from '@/lib/server/errors';

describe('validateUsername', () => {
  // ── valid cases ──────────────────────────────────────────────────────────

  describe('valid usernames', () => {
    it('accepts a single character username', () => {
      expect(() => validateUsername('a')).not.toThrow();
      expect(() => validateUsername('x')).not.toThrow();
      expect(() => validateUsername('z')).not.toThrow();
    });

    it('accepts a 20-character username', () => {
      expect(() => validateUsername('a'.repeat(20))).not.toThrow();
    });

    it('accepts usernames with digits', () => {
      expect(() => validateUsername('player1')).not.toThrow();
      expect(() => validateUsername('123')).not.toThrow();
    });

    it('accepts usernames with hyphens and underscores', () => {
      expect(() => validateUsername('my-name')).not.toThrow();
      expect(() => validateUsername('my_name')).not.toThrow();
      expect(() => validateUsername('a-b_c')).not.toThrow();
    });

    it('accepts mixed-case usernames', () => {
      expect(() => validateUsername('CamelCase')).not.toThrow();
      expect(() => validateUsername('UPPER')).not.toThrow();
    });
  });

  // ── length violations ────────────────────────────────────────────────────

  describe('length validation', () => {
    it('rejects an empty username (0 characters)', () => {
      expect(() => validateUsername('')).toThrow(ApiError);
      try {
        validateUsername('');
      } catch (e) {
        expect((e as ApiError).statusCode).toBe(400);
        expect((e as ApiError).message).toMatch(/at least 1/i);
      }
    });

    it('rejects a 21-character username', () => {
      expect(() => validateUsername('a'.repeat(21))).toThrow(ApiError);
      try {
        validateUsername('a'.repeat(21));
      } catch (e) {
        expect((e as ApiError).statusCode).toBe(400);
        expect((e as ApiError).message).toMatch(/20/);
      }
    });

    it('rejects a very long username', () => {
      expect(() => validateUsername('a'.repeat(100))).toThrow(ApiError);
    });
  });

  // ── space prohibition ────────────────────────────────────────────────────

  describe('space prohibition', () => {
    it('rejects usernames with spaces', () => {
      expect(() => validateUsername('user name')).toThrow(ApiError);
      try {
        validateUsername('user name');
      } catch (e) {
        expect((e as ApiError).statusCode).toBe(400);
        expect((e as ApiError).message).toMatch(/space/i);
      }
    });

    it('rejects usernames with leading spaces', () => {
      expect(() => validateUsername(' user')).toThrow(ApiError);
    });

    it('rejects usernames with trailing spaces', () => {
      expect(() => validateUsername('user ')).toThrow(ApiError);
    });

    it('rejects usernames with tab characters', () => {
      expect(() => validateUsername('user\tname')).toThrow(ApiError);
    });
  });

  // ── character restrictions ───────────────────────────────────────────────

  describe('character restrictions', () => {
    it('rejects usernames with special characters', () => {
      expect(() => validateUsername('user!')).toThrow(ApiError);
      expect(() => validateUsername('user@host')).toThrow(ApiError);
      expect(() => validateUsername('user#1')).toThrow(ApiError);
      expect(() => validateUsername('user$')).toThrow(ApiError);
      expect(() => validateUsername('user%')).toThrow(ApiError);
    });

    it('rejects usernames with brackets (other than allowed characters)', () => {
      expect(() => validateUsername('(user)')).toThrow(ApiError);
      expect(() => validateUsername('[user]')).toThrow(ApiError);
      expect(() => validateUsername('{user}')).toThrow(ApiError);
    });
  });

  // ── SQL injection patterns ───────────────────────────────────────────────

  describe('SQL injection rejection', () => {
    it('rejects usernames with single quotes', () => {
      expect(() => validateUsername("user'name")).toThrow(ApiError);
    });

    it('rejects usernames with double quotes', () => {
      expect(() => validateUsername('user"name')).toThrow(ApiError);
    });

    it('rejects usernames with semicolons', () => {
      expect(() => validateUsername('user;DROP')).toThrow(ApiError);
    });
  });

  // ── HTML/script injection ────────────────────────────────────────────────

  describe('HTML injection rejection', () => {
    it('rejects usernames with angle brackets', () => {
      expect(() => validateUsername('<script>')).toThrow(ApiError);
      expect(() => validateUsername('user<b>')).toThrow(ApiError);
    });

    it('rejects usernames with ampersand', () => {
      expect(() => validateUsername('user&name')).toThrow(ApiError);
    });
  });

});
