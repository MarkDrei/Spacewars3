import { useState, useEffect, useCallback } from 'react';
import { authService, SessionResponse } from '../services/authService';

export interface AuthState {
  isLoggedIn: boolean;
  username: string | null;
  shipId: number | null;
  isLoading: boolean;
}

const LOGGED_OUT_STATE: AuthState = {
  isLoggedIn: false,
  username: null,
  shipId: null,
  isLoading: false,
};

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    username: null,
    shipId: null,
    isLoading: true,
  });

  const applySession = useCallback((session: SessionResponse) => {
    setAuthState({
      isLoggedIn: session.loggedIn,
      username: session.username || null,
      shipId: session.shipId || null,
      isLoading: false,
    });
  }, []);

  /** Re-checks the session (e.g. after login/register); shows the loading state meanwhile. */
  const checkAuthStatus = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      applySession(await authService.checkSession());
    } catch {
      setAuthState(LOGGED_OUT_STATE);
    }
  };

  // Initial session check; the result is applied in a callback and ignored after unmount
  useEffect(() => {
    let ignore = false;
    authService.checkSession().then(
      session => { if (!ignore) applySession(session); },
      () => { if (!ignore) setAuthState(LOGGED_OUT_STATE); }
    );
    return () => {
      ignore = true;
    };
  }, [applySession]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authService.login({ username, password });
      
      if (result.success) {
        // Re-check auth status to get the shipId
        await checkAuthStatus();
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Login failed' };
      }
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (username: string, password: string, email?: string): Promise<{ success: boolean; error?: string; emailSent?: boolean }> => {
    try {
      const credentials = email && email.trim() ? { username, password, email: email.trim() } : { username, password };
      const result = await authService.register(credentials);
      
      if (result.success) {
        // Re-check auth status to get the shipId
        await checkAuthStatus();
        return { success: true, emailSent: result.emailSent };
      } else {
        return { success: false, error: result.error || 'Registration failed' };
      }
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState(LOGGED_OUT_STATE);
    }
  };

  return {
    ...authState,
    login,
    register,
    logout,
    checkAuthStatus,
  };
};
