'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../login/LoginPage.css';

interface ResetPasswordClientProps {
  token: string | null;
}

export const ResetPasswordClient: React.FC<ResetPasswordClientProps> = ({ token }) => {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset.');
      return;
    }

    if (!password) {
      setError('Please enter a new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json() as { success?: boolean; error?: string };

      if (response.ok && data.success) {
        setSuccessMessage('Password updated! Redirecting to sign in…');
        setTimeout(() => router.push('/login?reset=true'), 2000);
      } else {
        setError(data.error ?? 'Failed to reset password. The link may have expired.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Spacewars: Ironstrike</h1>
        <p>Set a new password for your account.</p>

        <div className="auth-form-container">
          <form onSubmit={handleSubmit} className="auth-form">
            {successMessage && <div className="success-message">{successMessage}</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="password">New Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
                disabled={isLoading || !!successMessage}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                disabled={isLoading || !!successMessage}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading || !!successMessage}
            >
              {isLoading ? 'Updating…' : 'Set New Password'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Remember your password?
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="link-button"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
