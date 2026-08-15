import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { User } from '../types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: (reason?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem('cargo_notify_token') || localStorage.getItem('cargo_notify_token');
  });
  const [loading, setLoading] = useState<boolean>(true);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = (reason?: string) => {
    sessionStorage.removeItem('cargo_notify_token');
    sessionStorage.removeItem('cargo_notify_user');
    localStorage.removeItem('cargo_notify_token');
    localStorage.removeItem('cargo_notify_user');
    if (reason) {
      sessionStorage.setItem('logout_reason', reason);
    }
    setToken(null);
    setUser(null);
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.user);
      } catch (err) {
        console.error('Session expirée ou invalide');
        logout();
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [token]);

  // Déconnexion automatique après 5 minutes d'inactivité
  useEffect(() => {
    if (!token || !user) return;

    lastActivityRef.current = Date.now();

    const resetInactivityTimer = () => {
      lastActivityRef.current = Date.now();
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    const checkInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        logout("Session expirée.");
      }
    }, 5000); // Vérification toutes les 5 secondes

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      clearInterval(checkInterval);
    };
  }, [token, user]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: userData } = res.data;
    
    // Stockage en sessionStorage pour expiration à la fermeture d'onglet/navigateur
    sessionStorage.setItem('cargo_notify_token', newToken);
    sessionStorage.setItem('cargo_notify_user', JSON.stringify(userData));

    // Nettoyage de l'ancien localStorage
    localStorage.removeItem('cargo_notify_token');
    localStorage.removeItem('cargo_notify_user');

    setToken(newToken);
    setUser(userData);
    lastActivityRef.current = Date.now();
    return userData;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé au sein d’un AuthProvider');
  }
  return context;
};
