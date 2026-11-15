import { describe, expect, test, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { setPasswordResetToken, sendEmail } = vi.hoisted(() => ({
  setPasswordResetToken: vi.fn(async () => {}),
  sendEmail: vi.fn(async () => {}),
}));

vi.mock('@/lib/server/database', () => ({ getDatabase: vi.fn(async () => ({})) }));
vi.mock('@/lib/server/user/userRepo', () => ({
  getUserByEmail: vi.fn(async () => ({ id: 7, username: 'pilot', preferred_locale: 'en' })),
  setPasswordResetToken,
}));
vi.mock('@/lib/server/email/emailConfig', () => ({
  isEmailEnabled: () => true,
  getEmailLinkBaseUrl: () => 'https://game.example',
}));
vi.mock('@/lib/server/email/emailService', () => ({ sendEmail }));
vi.mock('@/lib/server/email/emailTemplates', () => ({
  buildPasswordResetEmail: vi.fn(async () => ({ subject: 's', html: 'h', text: 't' })),
}));

import { POST as forgotPasswordPOST } from '@/app/api/forgot-password/route';

function requestFrom(ip: string, email: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ email }),
  });
}

describe('POST /api/forgot-password - mails per mailbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  test('forgotPassword_fourRequestsForOneMailboxFromDifferentAddresses_sendsOnlyThreeMails', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      // The mailbox is written differently each time; it is still the same mailbox
      const email = i % 2 === 0 ? 'Pilot@Example.com' : ' pilot@example.com ';
      const response = await forgotPasswordPOST(requestFrom(`203.0.113.${i}`, email));
      statuses.push(response.status);
    }

    // The fourth request is answered like the others, so it reveals nothing about the address
    expect(statuses).toEqual([200, 200, 200, 200]);
    expect(sendEmail).toHaveBeenCalledTimes(3);
    expect(setPasswordResetToken).toHaveBeenCalledTimes(3);
  });

  test('forgotPassword_otherMailbox_isNotAffectedByTheLimitOfTheFirst', async () => {
    for (let i = 0; i < 4; i++) {
      await forgotPasswordPOST(requestFrom(`203.0.113.${i}`, 'pilot@example.com'));
    }

    await forgotPasswordPOST(requestFrom('203.0.113.50', 'other@example.com'));

    expect(sendEmail).toHaveBeenCalledTimes(4);
    expect(sendEmail).toHaveBeenLastCalledWith('other@example.com', 's', 'h', 't');
  });
});
