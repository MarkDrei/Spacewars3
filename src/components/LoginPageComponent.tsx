'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
      setError('Please fill in all fields');
      return false;
    }

    if (isSignUp && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
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
            setSuccessMessage('Account created! Check your email to verify your address. Redirecting…');
            setTimeout(() => router.push('/game'), 3000);
          } else {
            router.push('/game');
          }
        } else {
          setError(result.error || 'Registration failed');
        }
      } else {
        const result = await login(formData.username, formData.password);
        if (result.success) {
          router.push('/game');
        } else {
          setError(result.error || 'Authentication failed');
        }
      }
    } catch {
      setError('An unexpected error occurred');
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
      setError('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    try {
      await forgotPasswordFn(forgotEmail.trim());
      // Always show the same message — no leakage of whether email exists
      setSuccessMessage('If that email is registered, a reset link has been sent. Check your inbox.');
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine banner message from query params (shown on login page after redirect)
  const queryBanner = verifiedParam === 'true'
    ? 'Email verified! You can now sign in.'
    : errorParam === 'invalid-token'
    ? 'Email verification link is invalid or has expired.'
    : resetParam === 'true'
    ? 'Password updated! You can now sign in with your new password.'
    : null;

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Spacewars: Ironstrike</h1>
        <p>Welcome to the space exploration game.</p>
        
        <div className="auth-form-container">
          {isForgotPassword ? (
            /* ── Forgot-password inline form ── */
            <>
              <h2 style={{ color: 'var(--primary-green)', marginBottom: '1rem', fontSize: '1.25rem' }}>
                Reset Password
              </h2>
              <form onSubmit={handleForgotPasswordSubmit} className="auth-form">
                {successMessage && <div className="success-message">{successMessage}</div>}
                {error && <div className="error-message">{error}</div>}
                {!successMessage && (
                  <div className="form-group">
                    <label htmlFor="forgotEmail">Email address</label>
                    <input
                      type="email"
                      id="forgotEmail"
                      name="forgotEmail"
                      value={forgotEmail}
                      onChange={(e) => { setForgotEmail(e.target.value); if (error) setError(''); }}
                      placeholder="Enter your registered email"
                      required
                    />
                  </div>
                )}
                {!successMessage && (
                  <button type="submit" className="btn-primary" disabled={isLoading}>
                    {isLoading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                )}
              </form>
              <div className="auth-footer">
                <p>
                  <button type="button" onClick={closeForgotPassword} className="link-button">
                    Back to Sign In
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
                  Sign In
                </button>
                <button
                  type="button"
                  className={`auth-tab ${isSignUp ? 'active' : ''}`}
                  onClick={() => isSignUp || toggleMode()}
                >
                  Sign Up
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
                  <label htmlFor="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Enter any username"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter any password"
                    required
                  />
                </div>

                {isSignUp && (
                  <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Confirm your password"
                      required
                    />
                  </div>
                )}

                {isSignUp && (
                  <div className="form-group">
                    <label htmlFor="email">
                      Email <span style={{ fontWeight: 'normal', color: '#607a99' }}>(optional)</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Email (optional — for account notifications)"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                >
                  {isLoading 
                    ? 'Loading...' 
                    : isSignUp 
                      ? 'Create Account' 
                      : 'Sign In'
                  }
                </button>

                {!isSignUp && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="link-button"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </form>

              <div className="auth-footer">
                <p>
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="link-button"
                  >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
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
