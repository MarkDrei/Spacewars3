import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock nodemailer before imports
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    })),
  },
}));

describe('emailService', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear the globalThis singleton
    delete (globalThis as Record<string, unknown>)['__spacewars_email_transport__'];
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>)['__spacewars_email_transport__'];
  });

  describe('when email is disabled (default)', () => {
    it('sendEmail logs warning and returns without sending', async () => {
      delete process.env.EMAIL_ENABLED;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const nodemailer = await import('nodemailer');
      const { sendEmail } = await import('@/lib/server/email/emailService');

      await sendEmail('user@example.com', 'Test Subject', '<p>Test</p>');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email not configured')
      );
      expect(nodemailer.default.createTransport).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('when email is enabled', () => {
    beforeEach(() => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'test@example.com';
      process.env.SMTP_PASS = 'pass';
      process.env.SMTP_FROM = 'noreply@example.com';
    });

    afterEach(() => {
      delete process.env.EMAIL_ENABLED;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.SMTP_FROM;
    });

    it('sendEmail calls transport.sendMail with correct params', async () => {
      const nodemailer = await import('nodemailer');
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'ok' });
      vi.mocked(nodemailer.default.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as unknown as ReturnType<typeof nodemailer.default.createTransport>);

      const { sendEmail } = await import('@/lib/server/email/emailService');

      await sendEmail('recipient@example.com', 'Hello', '<p>Hi</p>');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Hello',
          html: '<p>Hi</p>',
        })
      );
    });

    it('sendEmail swallows errors without throwing', async () => {
      const nodemailer = await import('nodemailer');
      const mockSendMail = vi.fn().mockRejectedValue(new Error('SMTP connection refused'));
      vi.mocked(nodemailer.default.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as unknown as ReturnType<typeof nodemailer.default.createTransport>);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { sendEmail } = await import('@/lib/server/email/emailService');

      // Should not throw
      await expect(sendEmail('x@example.com', 'Subj', '<p>body</p>')).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('resetEmailTransport', () => {
    it('clears the singleton transport', async () => {
      const { resetEmailTransport } = await import('@/lib/server/email/emailService');
      // Set a fake transport
      (globalThis as Record<string, unknown>)['__spacewars_email_transport__'] = { fake: true };
      resetEmailTransport();
      expect((globalThis as Record<string, unknown>)['__spacewars_email_transport__']).toBeNull();
    });
  });
});
