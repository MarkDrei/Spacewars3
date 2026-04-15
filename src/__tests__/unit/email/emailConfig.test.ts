import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('emailConfig', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules();
    Object.keys(process.env).forEach((key) => {
      if (['EMAIL_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].includes(key)) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    Object.assign(process.env, savedEnv);
    vi.resetModules();
  });

  describe('isEmailEnabled', () => {
    it('returns false by default', async () => {
      delete process.env.EMAIL_ENABLED;
      const { isEmailEnabled } = await import('@/lib/server/email/emailConfig');
      expect(isEmailEnabled()).toBe(false);
    });

    it('returns true when EMAIL_ENABLED=true', async () => {
      process.env.EMAIL_ENABLED = 'true';
      const { isEmailEnabled } = await import('@/lib/server/email/emailConfig');
      expect(isEmailEnabled()).toBe(true);
    });

    it('returns false when EMAIL_ENABLED=false', async () => {
      process.env.EMAIL_ENABLED = 'false';
      const { isEmailEnabled } = await import('@/lib/server/email/emailConfig');
      expect(isEmailEnabled()).toBe(false);
    });

    it('returns false when EMAIL_ENABLED is any other value', async () => {
      process.env.EMAIL_ENABLED = '1';
      const { isEmailEnabled } = await import('@/lib/server/email/emailConfig');
      expect(isEmailEnabled()).toBe(false);
    });
  });

  describe('getSmtpConfig', () => {
    it('returns defaults when env vars are not set', async () => {
      const { getSmtpConfig } = await import('@/lib/server/email/emailConfig');
      const cfg = getSmtpConfig();
      expect(cfg.port).toBe(587);
      expect(cfg.secure).toBe(false);
      expect(cfg.host).toBe('');
      expect(cfg.user).toBe('');
      expect(cfg.pass).toBe('');
      expect(cfg.from).toBe('');
    });

    it('reads SMTP env vars correctly', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 's3cret';
      process.env.SMTP_FROM = 'noreply@example.com';

      const { getSmtpConfig } = await import('@/lib/server/email/emailConfig');
      const cfg = getSmtpConfig();

      expect(cfg.host).toBe('smtp.example.com');
      expect(cfg.port).toBe(465);
      expect(cfg.secure).toBe(true);
      expect(cfg.user).toBe('user@example.com');
      expect(cfg.pass).toBe('s3cret');
      expect(cfg.from).toBe('noreply@example.com');
    });

    it('defaults SMTP_FROM to SMTP_USER when not set', async () => {
      process.env.SMTP_USER = 'sender@example.com';
      delete process.env.SMTP_FROM;

      const { getSmtpConfig } = await import('@/lib/server/email/emailConfig');
      const cfg = getSmtpConfig();

      expect(cfg.from).toBe('sender@example.com');
    });
  });
});
