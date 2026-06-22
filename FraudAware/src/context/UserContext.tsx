import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, logoutUser, type LoginRequest, type LoginResponse } from '../api/userApi';

// ============ STORAGE KEYS ============
const AUTH_TOKEN_KEY = '@fraudaware/auth_token';
const USER_DATA_KEY = '@fraudaware/user_data';

// ============ TYPES ============
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  headline?: string;
  role?: string;
  location?: string;
  accountStatus: string;
  emailVerified: boolean;
  isPremium: boolean;
  lastLoginAt: string;
}

export interface UserContextValue {
  // State
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  // Methods
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuthStatus: () => Promise<void>;
}

// ============ CONTEXT ============
const UserContext = createContext<UserContextValue | null>(null);

// ============ CUSTOM HOOK ============
export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider');
  }
  return ctx;
}

// ============ PROVIDER ============
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============ CHECK AUTH STATUS ON APP START ============
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // ============ CHECK STORED AUTH DATA ============
  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_DATA_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check auth status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============ LOGIN ============
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response: LoginResponse = await loginUser(credentials);

      if (response.success && response.token && response.user) {
        // Save token and user to AsyncStorage
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);
        await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(response.user));

        // Update context state
        setToken(response.token);
        setUser(response.user);
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============ LOGOUT ============
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Call logout API if token exists
      if (token) {
        await logoutUser(token);
      }

      // Clear AsyncStorage
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_DATA_KEY);

      // Clear context state
      setToken(null);
      setUser(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      // Still clear local state even if API call fails
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // ============ CLEAR ERROR ============
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============ CONTEXT VALUE ============
  const value: UserContextValue = {
    user,
    token,
    isLoading,
    error,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    clearError,
    checkAuthStatus,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
