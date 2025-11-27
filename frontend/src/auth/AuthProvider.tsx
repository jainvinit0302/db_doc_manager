// src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface User {
  id: number;
  email: string;
  name: string;
}

type AuthContextType = {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
};

const AUTH_TOKEN_KEY = "authToken";
const AUTH_USER_KEY = "authUser";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<User | null>(() => {
    try {
      const userStr = localStorage.getItem(AUTH_USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        } else {
          // Token is invalid, clear it
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error("Token verification failed:", error);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY) {
        setToken(e.newValue);
      } else if (e.key === AUTH_USER_KEY) {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
