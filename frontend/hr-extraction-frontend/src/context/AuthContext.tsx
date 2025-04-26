// // src/context/AuthContext.tsx
// import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
// import api from "../services/api";
// import {jwtDecode} from "jwt-decode";
// import { User } from "../types";

// interface Token {
//   access_token: string;
//   refresh_token: string;
//   token_type?: string;
// }

// interface AuthContextProps {
//   user: User | null;
//   token: string | null;
//   login: (tokenData: Token) => void;
//   logout: () => void;
//   silentRefresh: () => Promise<string>;
//   isLoading: boolean;
// }

// const AuthContext = createContext<AuthContextProps>({
//   user: null,
//   token: null,
//   login: () => {},
//   logout: () => {},
//   silentRefresh: () => Promise.resolve(""),
//   isLoading: true,
// });

// export const useAuth = () => useContext(AuthContext);

// export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
//   children,
// }) => {
//   const [user, setUser] = useState<User | null>(null);
//   const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
//   const [isLoading, setIsLoading] = useState(true);

//   const login = useCallback((tokenData: Token) => {
//     const { access_token, refresh_token } = tokenData;
//     localStorage.setItem("token", access_token);
//     localStorage.setItem("refreshToken", refresh_token);
//     setToken(access_token);
//   }, []);

//   const logout = useCallback(() => {
//     // Call logout API before clearing storage
//     api.post('/logout').catch(() => {}).finally(() => {
//       localStorage.removeItem("token");
//       localStorage.removeItem("refreshToken");
//       setToken(null);
//       setUser(null);
//       window.location.href = '/login';
//     });
//   }, []);

//   const silentRefresh = useCallback(async (): Promise<string> => {
//     try {
//       const refreshToken = localStorage.getItem('refreshToken');
//       if (!refreshToken) {
//         throw new Error('No refresh token available');
//       }

//       const response = await api.post<Token>('/refresh_token', { 
//         refresh_token: refreshToken 
//       });

//       const { access_token, refresh_token } = response.data;
//       localStorage.setItem("token", access_token);
//       localStorage.setItem("refreshToken", refresh_token);
//       setToken(access_token);

//       return access_token;
//     } catch (error) {
//       logout();
//       throw error;
//     }
//   }, [logout]);

//   // Initialize auth state
//   useEffect(() => {
//     const initializeAuth = async () => {
//       const token = localStorage.getItem('token');
      
//       if (!token) {
//         setIsLoading(false);
//         return;
//       }

//       try {
//         // Check if token is expired
//         const decoded = jwtDecode<{ exp: number }>(token);
//         const isExpired = decoded.exp * 1000 < Date.now();

//         if (isExpired) {
//           await silentRefresh();
//         }

//         // Fetch user data
//         const userResponse = await api.get('/users/me');
//         setUser(userResponse.data);
//       } catch (error) {
//         console.error('Auth initialization error:', error);
//         logout();
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     initializeAuth();
//   }, [logout, silentRefresh]);

//   // Setup token refresh timer
//   useEffect(() => {
//     if (!token) return;

//     const checkTokenExpiration = () => {
//       try {
//         const decoded = jwtDecode<{ exp: number }>(token);
//         const expiresIn = decoded.exp * 1000 - Date.now();
        
//         // Refresh token 1 minute before expiration
//         if (expiresIn < 60000) {
//           silentRefresh().catch(console.error);
//         }
//       } catch (error) {
//         console.error('Token check error:', error);
//       }
//     };

//     // Check immediately and then every 30 seconds
//     checkTokenExpiration();
//     const interval = setInterval(checkTokenExpiration, 30000);
    
//     return () => clearInterval(interval);
//   }, [token, silentRefresh]);

//   return (
//     <AuthContext.Provider 
//       value={{ 
//         user, 
//         token, 
//         login, 
//         logout, 
//         silentRefresh,
//         isLoading 
//       }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// };
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