import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { apiClient, AuthUser } from '@/lib/api';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    apiClient.setAuthToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      setUser(null);
      apiClient.setAuthToken(null);
    });

    // Validate any token persisted from a previous session
    if (apiClient.getAuthToken()) {
      apiClient
        .getCurrentUser()
        .then(setUser)
        .catch(() => apiClient.setAuthToken(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    return () => apiClient.setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const token = await apiClient.login(username, password);
    apiClient.setAuthToken(token.access_token);
    const currentUser = await apiClient.getCurrentUser();
    setUser(currentUser);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, login, logout }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
