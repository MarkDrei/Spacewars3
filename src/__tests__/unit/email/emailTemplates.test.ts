import { describe, it, expect } from 'vitest';

describe('emailTemplates', () => {
  it('buildVerificationEmail returns subject and html', async () => {
    const { buildVerificationEmail } = await import('@/lib/server/email/emailTemplates');
    const result = await buildVerificationEmail('testuser', 'https://example.com/api/verify-email?token=abc123');

    expect(result.subject).toContain('Verify');
    expect(result.html).toContain('testuser');
    expect(result.html).toContain('https://example.com/api/verify-email?token=abc123');
    expect(result.html).toContain('Spacewars: Ironstrike');
    expect(result.text).toContain('testuser');
    expect(result.text).toContain('https://example.com/api/verify-email?token=abc123');
    expect(result.text).toContain('Spacewars: Ironstrike');
  });

  it('escapes HTML in username to prevent injection', async () => {
    const { buildVerificationEmail } = await import('@/lib/server/email/emailTemplates');
    const result = await buildVerificationEmail('<script>alert(1)</script>', 'https://example.com/verify');

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('includes the verification URL as a clickable link', async () => {
    const { buildVerificationEmail } = await import('@/lib/server/email/emailTemplates');
    const url = 'https://game.example.com/api/verify-email?token=deadbeef';
    const result = await buildVerificationEmail('player1', url);

    // Both anchor href and text content should have the URL
    const hrefCount = (result.html.match(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    expect(hrefCount).toBeGreaterThanOrEqual(2);
  });

  it('buildVerificationEmail with German locale returns German subject', async () => {
    const { buildVerificationEmail } = await import('@/lib/server/email/emailTemplates');
    const result = await buildVerificationEmail('spieler1', 'https://example.com/verify', 'de');

    expect(result.subject).toContain('Bestätige');
    expect(result.html).toContain('spieler1');
    expect(result.html).toContain('de');
  });

  it('buildPasswordResetEmail returns subject and html', async () => {
    const { buildPasswordResetEmail } = await import('@/lib/server/email/emailTemplates');
    const result = await buildPasswordResetEmail('testuser', 'https://example.com/reset?token=abc');

    expect(result.subject).toContain('Reset');
    expect(result.html).toContain('testuser');
    expect(result.html).toContain('https://example.com/reset?token=abc');
    expect(result.text).toContain('testuser');
  });

  it('buildPasswordResetEmail with German locale returns German subject', async () => {
    const { buildPasswordResetEmail } = await import('@/lib/server/email/emailTemplates');
    const result = await buildPasswordResetEmail('spieler1', 'https://example.com/reset?token=abc', 'de');

    expect(result.subject).toContain('zurück');
    expect(result.html).toContain('spieler1');
  });
});
