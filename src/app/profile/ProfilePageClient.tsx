'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { ServerAuthState } from '@/lib/server/serverSession';
import { useAuth } from '@/lib/client/hooks/useAuth';
import { userStatsService, UserStatsResponse } from '@/lib/client/services/userStatsService';
import './ProfilePage.css';
import StatisticsPanel from '@/components/Statistics/StatisticsPanel';
import Leaderboard from '@/components/Statistics/Leaderboard';
import LocaleSwitcher from '@/components/Navigation/LocaleSwitcher';

interface ProfilePageClientProps {
  auth: ServerAuthState;
}

interface BattleHistoryItem {
  id: number;
  opponentUsername: string;
  isAttacker: boolean;
  didWin: boolean;
  userDamage: number;
  opponentDamage: number;
  duration: number;
  battleStartTime: number;
  battleEndTime: number | null;
}

const ProfilePageClient: React.FC<ProfilePageClientProps> = ({ auth }) => {
  const router = useRouter();
  const { logout } = useAuth();
  const t = useTranslations('profile');
  const locale = useLocale();
  const [battles, setBattles] = useState<BattleHistoryItem[]>([]);
  const [isLoadingBattles, setIsLoadingBattles] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [liveStats, setLiveStats] = useState<UserStatsResponse | null>(null);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    router.push('/'); // Redirect to login page
  };

  const resetChangePasswordForm = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setChangePasswordError('');
    setChangePasswordSuccess('');
  };

  const openChangePasswordDialog = () => {
    resetChangePasswordForm();
    setIsChangePasswordDialogOpen(true);
  };

  const closeChangePasswordDialog = () => {
    setIsChangePasswordDialogOpen(false);
    resetChangePasswordForm();
  };

  const handlePasswordInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (changePasswordError) {
      setChangePasswordError('');
    }
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setChangePasswordError(t('errorFillPasswordFields'));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setChangePasswordError(t('errorNewPasswordsNoMatch'));
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(passwordForm),
      });
      const data = await response.json();

      if (!response.ok) {
        setChangePasswordError(data.error || t('errorChangePasswordFailed'));
        return;
      }

      setChangePasswordSuccess(data.message || t('successPasswordChanged'));
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch {
      setChangePasswordError(t('errorChangePasswordFailed'));
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  // Fetch battle history and user stats on component mount
  useEffect(() => {
    const fetchBattles = async () => {
      try {
        const response = await fetch('/api/user-battles');
        if (response.ok) {
          const data = await response.json();
          setBattles(data.battles || []);
        }
      } catch (error) {
        console.error('Failed to fetch battle history:', error);
      } finally {
        setIsLoadingBattles(false);
      }
    };

    const fetchStats = async () => {
      const result = await userStatsService.getUserStats();
      if (!('error' in result)) {
        setLiveStats(result);
      }
    };
    
    fetchBattles();
    fetchStats();
  }, []);

  return (
    <AuthenticatedLayout>
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-top-bar">
            <h1 className="page-heading">{t('pageHeading')}</h1>
            <div className="profile-top-bar-actions">
              <div className="profile-language-control">
                <span className="profile-language-label">{t('languageLabel')}</span>
                <LocaleSwitcher />
              </div>
              <button
                className="btn-secondary"
                onClick={openChangePasswordDialog}
                type="button"
              >
                {t('changePasswordButton')}
              </button>
              <button
                className="logout-button"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? t('loggingOutButton') : t('logoutButton')}
              </button>
            </div>
          </div>
          <div className="profile-header">
            <div className="avatar">
              <span className="avatar-text">{auth.username.charAt(0)}</span>
            </div>
            <div className="player-info">
              <h2>{auth.username}</h2>
              <p className="level">{t('levelDisplay', { level: liveStats?.level ?? '...' })}</p>
              <p className="total-score">{t('scoreXpDisplay', { score: (liveStats?.score ?? 0).toLocaleString(locale), xp: (liveStats?.xp ?? 0).toLocaleString(locale) })}</p>
            </div>
          </div>

          {/* Statistics Panel */}
          <StatisticsPanel />

          {/* Leaderboard & Best In Categories */}
          <Leaderboard />

          {/* Battle History Section */}
          <div className="battle-history">
            <h3>{t('battleHistoryHeading')}</h3>
            {isLoadingBattles ? (
              <p className="loading-message">{t('loadingBattleHistory')}</p>
            ) : battles.length === 0 ? (
              <p className="no-battles-message">{t('noBattlesYet')}</p>
            ) : (
              <div className="battle-list">
                {battles.map((battle) => (
                  <div
                    key={battle.id}
                    className={`battle-card ${battle.didWin ? 'victory' : 'defeat'}`}
                  >
                    <div className="battle-header">
                      <span className={`battle-result ${battle.didWin ? 'win' : 'loss'}`}>
                        {battle.didWin ? t('victory') : t('defeat')}
                      </span>
                      <span className="battle-role">
                        {battle.isAttacker ? t('attackerRole') : t('defenderRole')}
                      </span>
                    </div>
                    <div className="battle-details">
                      <div className="battle-opponent">
                        <strong>{t('opponentLabel')}</strong> {battle.opponentUsername}
                      </div>
                      <div className="battle-stats">
                        <div className="stat-item">
                          <span className="stat-label">{t('yourDamageLabel')}</span>
                          <span className="stat-value">{Math.round(battle.userDamage)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">{t('opponentDamageLabel')}</span>
                          <span className="stat-value">{Math.round(battle.opponentDamage)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">{t('durationLabel')}</span>
                          <span className="stat-value">{battle.duration}s</span>
                        </div>
                      </div>
                      <div className="battle-time">
                        {new Date(battle.battleStartTime * 1000).toLocaleString(locale)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
      {isChangePasswordDialogOpen && (
        <div className="dialog-overlay" role="presentation">
          <div
            className="change-password-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-dialog-title"
          >
            <div className="change-password-dialog-header">
              <h2 id="change-password-dialog-title">{t('changePasswordDialogTitle')}</h2>
              <button
                type="button"
                className="dialog-close-button"
                onClick={closeChangePasswordDialog}
                aria-label="Close change password dialog"
              >
                ×
              </button>
            </div>
            <form className="change-password-form" onSubmit={handleChangePassword}>
              {changePasswordError && (
                <div className="change-password-message error">{changePasswordError}</div>
              )}
              {changePasswordSuccess && (
                <div className="change-password-message success">{changePasswordSuccess}</div>
              )}
              <label className="change-password-field">
                <span>{t('currentPasswordLabel')}</span>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordInputChange}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label className="change-password-field">
                <span>{t('newPasswordLabel')}</span>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordInputChange}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label className="change-password-field">
                <span>{t('confirmNewPasswordLabel')}</span>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordInputChange}
                  autoComplete="new-password"
                  required
                />
              </label>
              <div className="change-password-actions">
                <button type="button" className="dialog-secondary-button" onClick={closeChangePasswordDialog}>
                  {t('cancelButton')}
                </button>
                <button type="submit" className="dialog-primary-button" disabled={isChangingPassword}>
                  {isChangingPassword ? t('savingButton') : t('savePasswordButton')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
};

export default ProfilePageClient;
