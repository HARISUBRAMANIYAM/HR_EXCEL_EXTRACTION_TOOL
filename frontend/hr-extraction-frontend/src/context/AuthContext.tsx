// src/context/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import { Token, User } from "../types";

interface AuthContextProps {
  user: User | null;
  token: string | null;
  login: (token: Token) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token") || null
  );
  const [isLoading, setIsLoading] = useState(true);

  const login = (tokenData: Token) => {
    const { access_token } = tokenData;
    localStorage.setItem("token", access_token);
    setToken(access_token);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("http://localhost:8000/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          console.log("Auth State:",{user,token})
        } else {
          logout();
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
