// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../services/api";
import {jwtDecode} from "jwt-decode";

interface AuthContextProps {
  user: any;
  token: string | null;
  login: (tokenData: { access_token: string; refresh_token: string }) => void;
  logout: () => Promise<void>; // Changed to async
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextProps>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback((tokenData: { access_token: string; refresh_token: string }) => {
    localStorage.setItem("token", tokenData.access_token);
    localStorage.setItem("refreshToken", tokenData.refresh_token);
    setToken(tokenData.access_token);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const decoded = jwtDecode<{ exp: number }>(token);
        const isExpired = decoded.exp * 1000 < Date.now();

        if (isExpired) {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            const response = await api.post('/refresh_token', { 
              refresh_token: refreshToken 
            });
            login(response.data);
          } else {
            throw new Error('No refresh token available');
          }
        }

        const userResponse = await api.get('/users/me');
        setUser(userResponse.data);
      } catch (error) {
        console.error('Auth initialization error:', error);
        await logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [token]);

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};