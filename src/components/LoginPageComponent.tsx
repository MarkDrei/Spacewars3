'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/client/hooks/useAuth';
import '../app/login/LoginPage.css';

async function defaultForgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await response.json() as { success?: boolean; error?: string };
  return { success: response.ok && !!data.success, error: data.error };
}

export interface LoginPageComponentProps {
  onLogin?: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onRegister?: (username: string, password: string, email?: string) => Promise<{ success: boolean; error?: string; emailSent?: boolean }>;
  onForgotPassword?: (email: string) => Promise<{ success: boolean; error?: string }>;
  /** Passed from the page's searchParams when email has been verified */
  verifiedParam?: string | null;
  /** Passed from the page's searchParams when token was invalid */
  errorParam?: string | null;
  /** Passed from the page's searchParams when password has been reset */
  resetParam?: string | null;
}

export const LoginPageComponent: React.FC<LoginPageComponentProps> = ({
  onLogin: propOnLogin,
  onRegister: propOnRegister,
  onForgotPassword: propOnForgotPassword,
  verifiedParam,
  errorParam,
  resetParam,
}) => {
  const router = useRouter();
  const { login: hookLogin, register: hookRegister } = useAuth();
  const t = useTranslations('auth');
  
  // Use props if provided (for testing), otherwise use hooks
  const login = propOnLogin || hookLogin;
  const register = propOnRegister || hookRegister;
  const forgotPasswordFn = propOnForgotPassword || defaultForgotPassword;
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.username.trim() || !formData.password.trim()) {
      setError(t('errorFillAllFields'));
      return false;
    }

    if (isSignUp && formData.password !== formData.confirmPassword) {
      setError(t('errorPasswordsNoMatch'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (isSignUp) {
        const result = await register(formData.username, formData.password, formData.email || undefined);
        if (result.success) {
          if (result.emailSent) {
            setSuccessMessage(t('successAccountCreated'));
            setTimeout(() => router.push('/game'), 3000);
          } else {
            router.push('/game');
          }
        } else {
          setError(result.error || t('errorRegistrationFailed'));
        }
      } else {
        const result = await login(formData.username, formData.password);
        if (result.success) {
          router.push('/game');
        } else {
          setError(result.error || t('errorAuthFailed'));
        }
      }
    } catch {
      setError(t('errorUnexpected'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setIsForgotPassword(false);
    setForgotEmail('');
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      email: '',
    });
    setError('');
    setSuccessMessage('');
  };

  const openForgotPassword = () => {
    setIsForgotPassword(true);
    setError('');
    setSuccessMessage('');
  };

  const closeForgotPassword = () => {
    setIsForgotPassword(false);
    setForgotEmail('');
    setError('');
    setSuccessMessage('');
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!forgotEmail.trim()) {
      setError(t('errorEnterEmail'));
      return;
    }
    setIsLoading(true);
    try {
      await forgotPasswordFn(forgotEmail.trim());
      // Always show the same message — no leakage of whether email exists
      setSuccessMessage(t('successResetLinkSent'));
    } catch {
      setError(t('errorUnexpectedRetry'));
    } finally {
      setIsLoading(false);
    }
  };

  // Determine banner message from query params (shown on login page after redirect)
  const queryBanner = verifiedParam === 'true'
    ? t('bannerEmailVerified')
    : errorParam === 'invalid-token'
    ? t('bannerInvalidToken')
    : resetParam === 'true'
    ? t('bannerPasswordReset')
    : null;

  return (
    <div className="login-page">
      <div className="alpha-banner">
        <div className="alpha-banner-content">
          <h2>{t('alphaBannerTitle')}</h2>
          <p>{t('alphaBannerBody')}</p>
          <p>
            {t('alphaBannerFeedbackPrefix')}{' '}
            <a href="mailto:spacewars@ironstrike.de">spacewars@ironstrike.de</a>
          </p>
        </div>
      </div>
      <div className="login-container">
        <h1>{t('gameTitle')}</h1>
        <p>{t('welcomeSubtitle')}</p>
        
        <div className="auth-form-container">
          {isForgotPassword ? (
            /* ── Forgot-password inline form ── */
            <>
              <h2 style={{ color: 'var(--primary-green)', marginBottom: '1rem', fontSize: '1.25rem' }}>
                {t('resetPasswordHeading')}
              </h2>
              <form onSubmit={handleForgotPasswordSubmit} className="auth-form">
                {successMessage && <div className="success-message">{successMessage}</div>}
                {error && <div className="error-message">{error}</div>}
                {!successMessage && (
                  <div className="form-group">
                    <label htmlFor="forgotEmail">{t('emailAddressLabel')}</label>
                    <input
                      type="email"
                      id="forgotEmail"
                      name="forgotEmail"
                      value={forgotEmail}
                      onChange={(e) => { setForgotEmail(e.target.value); if (error) setError(''); }}
                      placeholder={t('emailAddressPlaceholder')}
                      required
                    />
                  </div>
                )}
                {!successMessage && (
                  <button type="submit" className="btn-primary" disabled={isLoading}>
                    {isLoading ? t('sendingButton') : t('sendResetLinkButton')}
                  </button>
                )}
              </form>
              <div className="auth-footer">
                <p>
                  <button type="button" onClick={closeForgotPassword} className="link-button">
                    {t('backToSignIn')}
                  </button>
                </p>
              </div>
            </>
          ) : (
            /* ── Normal login / register ── */
            <>
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`auth-tab ${!isSignUp ? 'active' : ''}`}
                  onClick={() => !isSignUp || toggleMode()}
                >
                  {t('signInTab')}
                </button>
                <button
                  type="button"
                  className={`auth-tab ${isSignUp ? 'active' : ''}`}
                  onClick={() => isSignUp || toggleMode()}
                >
                  {t('signUpTab')}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="auth-form">
                {queryBanner && (
                  <div className={errorParam ? 'error-message' : 'success-message'}>
                    {queryBanner}
                  </div>
                )}
                {successMessage && <div className="success-message">{successMessage}</div>}
                {error && <div className="error-message">{error}</div>}
                
                <div className="form-group">
                  <label htmlFor="username">{t('usernameLabel')}</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder={t('usernamePlaceholder')}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">{t('passwordLabel')}</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={t('passwordPlaceholder')}
                    required
                  />
                </div>

                {isSignUp && (
                  <div className="form-group">
                    <label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder={t('confirmPasswordPlaceholder')}
                      required
                    />
                  </div>
                )}

                {isSignUp && (
                  <div className="form-group">
                    <label htmlFor="email">
                      {t('emailLabel')} <span style={{ fontWeight: 'normal', color: '#607a99' }}>{t('emailOptional')}</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder={t('emailPlaceholder')}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                >
                  {isLoading 
                    ? t('loadingButton') 
                    : isSignUp 
                      ? t('createAccountButton') 
                      : t('signInButton')
                  }
                </button>

                {!isSignUp && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="link-button"
                    >
                      {t('forgotPassword')}
                    </button>
                  </div>
                )}
              </form>

              <div className="auth-footer">
                <p>
                  {isSignUp ? t('alreadyHaveAccount') : t('noAccountYet')}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="link-button"
                  >
                    {isSignUp ? t('signInTab') : t('signUpTab')}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
