import { useState, useEffect } from 'react';
import { authService, SessionResponse } from '../services/authService';

export interface AuthState {
  isLoggedIn: boolean;
  username: string | null;
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    username: null,
    isLoading: true,
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const session: SessionResponse = await authService.checkSession();
      setAuthState({
        isLoggedIn: session.loggedIn,
        username: session.username || null,
        isLoading: false,
      });
    } catch (error) {
      setAuthState({
        isLoggedIn: false,
        username: null,
        isLoading: false,
      });
    }
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authService.login({ username, password });
      
      if (result.success) {
        setAuthState({
          isLoggedIn: true,
          username: username,
          isLoading: false,
        });
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authService.register({ username, password });
      
      if (result.success) {
        setAuthState({
          isLoggedIn: true,
          username: username,
          isLoading: false,
        });
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Registration failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState({
        isLoggedIn: false,
        username: null,
        isLoading: false,
      });
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
