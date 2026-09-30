import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser } from '../types/gmao';
import { isMobileApp } from '../lib/utils';

interface AuthContextType {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isTechnician: boolean;
  isAccounting: boolean;
  login: (user: AppUser, token?: string) => void;
  logout: () => Promise<void>;
  updateUserSignature: (signatureUrl: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode; currentUser?: AppUser }> = ({
  children,
  currentUser,
}) => {
  const isMobile = isMobileApp();

  // Initialize user: if currentUser prop passed, use it, otherwise null to open Login page
  const [user, setUser] = useState<AppUser | null>(() => {
    if (currentUser) return currentUser;
    return null;
  });

  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
      setLoading(false);
      return;
    }

    // When running the app, check if an existing valid session token exists
    const checkAuth = async () => {
      try {
        // In mobile/tablet mode: never restore a saved session.
        // Every page refresh must go through Login again.
        if (isMobile) {
          sessionStorage.removeItem('mobileCurrentUser');
          sessionStorage.removeItem('mobileAuthToken');
          setUser(null);
          setLoading(false);
          return;
        }

        const token = localStorage.getItem('authToken');

        if (!token) {
          // No token: ensure user is null so Login page is shown
          setUser(null);
          setLoading(false);
          return;
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };

        const res = await fetch('/api/auth/me', { headers, credentials: 'include' });
        const contentType = res.headers.get('content-type');

        if (res.ok && contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            if (!isMobile) {
              localStorage.setItem('currentUser', JSON.stringify(data.user));
              if (data.token) localStorage.setItem('authToken', data.token);
            } else {
              sessionStorage.setItem('mobileCurrentUser', JSON.stringify(data.user));
              if (data.token) sessionStorage.setItem('mobileAuthToken', data.token);
            }
          } else {
            setUser(null);
          }
        } else {
          // 401 or invalid session: clear stale tokens and open Login page
          setUser(null);
          try {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('mobileCurrentUser');
            sessionStorage.removeItem('mobileAuthToken');
          } catch {}
        }
      } catch (err) {
        console.warn('[Auth] Session check failed, redirecting to login:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [currentUser, isMobile]);

  const login = (userData: AppUser, token?: string) => {
    setUser(userData);
    try {
      if (isMobileApp()) {
        sessionStorage.setItem('mobileCurrentUser', JSON.stringify(userData));
        if (token) sessionStorage.setItem('mobileAuthToken', token);
      } else {
        localStorage.setItem('currentUser', JSON.stringify(userData));
        if (token) localStorage.setItem('authToken', token);
      }
    } catch {}
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('[Auth] Logout failed:', err);
    } finally {
      setUser(null);
      try {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('mobileCurrentUser');
        sessionStorage.removeItem('mobileAuthToken');
      } catch {}
    }
  };

  const updateUserSignature = (signatureUrl: string) => {
    setUser((prev) => (prev ? { ...prev, signatureUrl } : null));
  };

  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role.includes('admin') || role.includes('direction') || role.includes('technique');
  const isManager = isAdmin || role === 'manager' || role.includes('responsable') || role.includes('production') || role.includes('qhse');
  const isTechnician = role === 'technician' || role.includes('tech') || isManager;
  const isAccounting = role === 'accounting' || role.includes('compt') || isAdmin;

  const value: AuthContextType = {
    user,
    setUser,
    loading,
    isAdmin,
    isManager,
    isTechnician,
    isAccounting,
    login,
    logout,
    updateUserSignature,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
