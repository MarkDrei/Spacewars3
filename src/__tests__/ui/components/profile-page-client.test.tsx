import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePageClient from '@/app/profile/ProfilePageClient';
import { userStatsService } from '@/lib/client/services/userStatsService';

const pushMock = vi.fn();
const logoutMock = vi.fn();

vi.mock('@/components/Layout/AuthenticatedLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/Statistics/StatisticsPanel', () => ({
  __esModule: true,
  default: () => <div>Statistics Panel</div>,
}));

vi.mock('@/components/Statistics/Leaderboard', () => ({
  __esModule: true,
  default: () => <div>Leaderboard</div>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/lib/client/hooks/useAuth', () => ({
  useAuth: () => ({
    logout: logoutMock,
  }),
}));

vi.mock('@/lib/client/services/userStatsService', () => ({
  userStatsService: {
    getUserStats: vi.fn(),
  },
}));

describe('ProfilePageClient change password dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userStatsService.getUserStats).mockResolvedValue({
      iron: 0,
      last_updated: 0,
      ironPerSecond: 0,
      maxIronCapacity: 0,
      xp: 12,
      level: 2,
      xpForNextLevel: 100,
      score: 34,
      timeMultiplier: 1,
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0,
      levelMultiplier: 1,
      maxShipSpeed: 0,
      currentMaxShipSpeed: 0,
      hullRepairSpeed: 0,
      armorRepairSpeed: 0,
      shieldRechargeRate: 0,
      projectileWeaponDamageFactor: 0,
      projectileWeaponReloadFactor: 0,
      projectileWeaponAccuracyFactor: 0,
      energyWeaponDamageFactor: 0,
      energyWeaponReloadFactor: 0,
      energyWeaponAccuracyFactor: 0,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url === '/api/user-battles') {
          return Promise.resolve(
            new Response(JSON.stringify({ battles: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }

        if (url === '/api/change-password') {
          return Promise.resolve(
            new Response(JSON.stringify({ success: true, message: 'Password changed successfully' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }

        return Promise.reject(new Error(`Unexpected fetch for ${url}`));
      })
    );
  });

  it('changePassword_validSubmission_postsFormAndShowsSuccess', async () => {
    render(<ProfilePageClient auth={{ userId: 1, username: 'captain' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Password' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: 'old-password',
          newPassword: 'new-password',
          confirmPassword: 'new-password',
        }),
      });
    });

    expect(await screen.findByText('Password changed successfully')).toBeInTheDocument();
  });

  it('changePassword_mismatchedPasswords_showsValidationErrorWithoutRequest', async () => {
    render(<ProfilePageClient auth={{ userId: 1, username: 'captain' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'different-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Password' }));

    expect(await screen.findByText('New passwords do not match')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalledWith('/api/change-password', expect.anything());
  });
});
