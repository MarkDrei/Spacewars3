'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/client/hooks/useAuth';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const router = useRouter();
  const { login, register } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
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

    try {
      const result = isSignUp 
        ? await register(formData.username, formData.password)
        : await login(formData.username, formData.password);

      if (result.success) {
        // Redirect to game page on successful login/register
        router.push('/game');
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
    });
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Spacewars: Ironcore</h1>
        <p>Welcome to the space exploration game.</p>
        
        <div className="auth-form-container">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${!isSignUp ? 'active' : ''}`}
              onClick={() => !isSignUp || toggleMode()}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${isSignUp ? 'active' : ''}`}
              onClick={() => isSignUp || toggleMode()}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
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
                disabled={isLoading}
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
                disabled={isLoading}
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
                  disabled={isLoading}
                  required
                />
              </div>
            )}

            <button 
              type="submit"
              className="auth-button"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button
                type="button"
                className="link-button"
                onClick={toggleMode}
                disabled={isLoading}
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
