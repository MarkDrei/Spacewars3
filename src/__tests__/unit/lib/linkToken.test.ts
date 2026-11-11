import { describe, it, expect } from 'vitest';
import { createLinkToken, hashLinkToken } from '@/lib/server/user/linkToken';

describe('linkToken', () => {
  it('createLinkToken_calledTwice_returnsDifferentTokensOf64HexCharacters', () => {
    const first = createLinkToken();
    const second = createLinkToken();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });

  it('hashLinkToken_knownInput_returnsItsSha256Hash', () => {
    // SHA-256 test vector for "abc"
    expect(hashLinkToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashLinkToken_sameToken_returnsTheSameHash', () => {
    const token = createLinkToken();

    expect(hashLinkToken(token)).toBe(hashLinkToken(token));
    expect(hashLinkToken(token)).not.toBe(token);
  });
});
