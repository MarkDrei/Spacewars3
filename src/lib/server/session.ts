import { SessionOptions } from 'iron-session';
import type { CommanderData } from '@/lib/server/inventory/Commander';

export interface SessionData {
  userId?: number;
  starbaseShop?: CommanderData[];
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'your-secret-key-must-be-at-least-32-characters-long',
  cookieName: 'spacewars-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60, // 24 hours in seconds
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
};

export { getIronSession } from 'iron-session';
