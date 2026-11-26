"use client";

import { useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { getSession } from "./auth-server";

interface User {
  id: string;
  email: string;
  plan: "free" | "premium";
  credits: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const response = await getSession();
      if (response.ok && response.user) {
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Auth refresh failed:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = { user, loading, refresh };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
