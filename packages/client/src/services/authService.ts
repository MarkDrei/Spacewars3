// Authentication service for API calls
const API_BASE = '/api';

export interface AuthResponse {
  success?: boolean;
  error?: string;
}

export interface SessionResponse {
  loggedIn: boolean;
  username?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export const authService = {
  async register(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Register failed:', response.status, data);
        return { error: data.error || `Server error: ${response.status}` };
      }
      
      return data;
    } catch (error) {
      console.error('Network error during register:', error);
      return { error: 'Network error' };
    }
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Login failed:', response.status, data);
        return { error: data.error || `Server error: ${response.status}` };
      }
      
      return data;
    } catch (error) {
      console.error('Network error during login:', error);
      return { error: 'Network error' };
    }
  },

  async logout(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Logout failed:', response.status, data);
        return { error: data.error || `Server error: ${response.status}` };
      }
      
      return data;
    } catch (error) {
      console.error('Network error during logout:', error);
      return { error: 'Network error' };
    }
  },

  async checkSession(): Promise<SessionResponse> {
    try {
      const response = await fetch(`${API_BASE}/session`, {
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Session check failed:', response.status, data);
        return { loggedIn: false };
      }
      
      return data;
    } catch (error) {
      console.error('Network error during session check:', error);
      return { loggedIn: false };
    }
  },
  
  async testServerConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE}/session`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        return { connected: true };
      } else {
        return { connected: false, error: `Server responded with status: ${response.status}` };
      }
    } catch (error) {
      console.error('Server connection test failed:', error);
      return { connected: false, error: 'Failed to connect to server' };
    }
  },
};
