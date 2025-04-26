// src/hooks/useTokenRefresh.ts
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {jwtDecode} from 'jwt-decode';

export const useTokenRefresh = () => {
  const { silentRefresh } = useAuth();

  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const decoded = jwtDecode(token) as { exp: number };
      const expiresIn = decoded.exp * 1000 - Date.now();
      
      // Refresh token 1 minute before expiration
      if (expiresIn < 60000) {
        silentRefresh().catch(console.error);
      }
    };

    // Check token periodically
    const interval = setInterval(checkToken, 30000); // Every 30 seconds
    checkToken(); // Initial check
    
    return () => clearInterval(interval);
  }, [silentRefresh]);
};