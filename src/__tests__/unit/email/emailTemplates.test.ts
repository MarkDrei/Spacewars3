import { describe, it, expect } from 'vitest';

describe('emailTemplates', () => {
  it('buildVerificationEmail returns subject and html', async () => {
    const { buildVerificationEmail } = await import('@/lib/server/email/emailTemplates');
    const result = buildVerificationEmail('testuser', 'https://example.com/api/verify-email?token=abc123');

    expect(result.subject).toContain('Verify');
    expect(result.html).toContain('testuser');
    expect(result.html).toContain('https://example.com/api/verify-email?token=abc123');
    expect(result.html).toContain('Spacewars: Ironcore');
    expect(result.html).toContain('24 hours');
  });

  it('escapes HTML in username to prevent injection', async () => {
    const { buildVerificationEmail } = await import('@/lib/server/email/emailTemplates');
    const result = buildVerificationEmail('<script>alert(1)</script>', 'https://example.com/verify');

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('includes the verification URL as a clickable link', async () => {
    const { buildVerificationEmail } = await import('@/lib/server/email/emailTemplates');
    const url = 'https://game.example.com/api/verify-email?token=deadbeef';
    const result = buildVerificationEmail('player1', url);

    // Both anchor href and text content should have the URL
    const hrefCount = (result.html.match(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    expect(hrefCount).toBeGreaterThanOrEqual(2);
  });
});
