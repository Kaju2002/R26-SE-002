import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  type LoginRequest,
  type LoginResponse,
} from '../api/userApi';
import { clearPushRegistration } from '../notifications/pushRegistration';
import { clearHomeHeroDismissed } from '../utils/homeHeroStorage';

const AUTH_TOKEN_KEY = '@fraudaware/auth_token';
const USER_DATA_KEY = '@fraudaware/user_data';

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
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuthStatus: () => Promise<void>;
  clearSession: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider');
  }
  return ctx;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearSession = useCallback(async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_DATA_KEY]);
    setToken(null);
    setUser(null);
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      setIsInitializing(true);
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

      if (!storedToken) {
        await clearSession();
        return;
      }

      const response = await getCurrentUser(storedToken);
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(response.user));
      setToken(storedToken);
      setUser(response.user);
    } catch (err) {
      console.error('Error checking auth status:', err);
      await clearSession();
      setError(err instanceof Error ? err.message : 'Failed to check auth status');
    } finally {
      setIsInitializing(false);
    }
  }, [clearSession]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response: LoginResponse = await loginUser(credentials);

      if (response.success && response.token && response.user) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);
        await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(response.user));
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

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (token) {
        await clearPushRegistration(token);
        await logoutUser(token);
      }

      await clearSession();
      await clearHomeHeroDismissed();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      await clearSession();
      await clearHomeHeroDismissed();
    } finally {
      setIsLoading(false);
    }
  }, [token, clearSession]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: UserContextValue = {
    user,
    token,
    isLoading,
    isInitializing,
    error,
    isAuthenticated: !!token && !!user && !isInitializing,
    login,
    logout,
    clearError,
    checkAuthStatus,
    clearSession,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
