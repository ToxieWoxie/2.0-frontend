// components/AuthProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AuthUser } from "../lib/auth.types";
import { getCurrentUser, logIn, logOut, signUp } from "../lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  loginUser: (userName: string, password: string, email: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  registerUser: (userName: string, password: string, email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (t) clearTimeout(t);
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const u = await withTimeout(getCurrentUser(), 8000, "getCurrentUser");
      if (mountedRef.current) setUser(u);
    } catch (e) {
      console.error(e);
      if (mountedRef.current) setUser(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const loginUser = useCallback(
    async (_userName: string, password: string, email: string) => {
      const trimmedEmail = (email ?? "").trim();
      if (!trimmedEmail) throw new Error("Email is required to sign in.");
      if (!password) throw new Error("Password is required to sign in.");

      setLoading(true);
      try {
        const u = await withTimeout(
          logIn({ email: trimmedEmail, password }),
          8000,
          "logIn"
        );
        if (mountedRef.current) setUser(u);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    []
  );

  const logoutUser = useCallback(async () => {
    setLoading(true);
    try {
      await withTimeout(logOut(), 8000, "logOut");
      if (mountedRef.current) setUser(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const registerUser = useCallback(async (userName: string, password: string, email: string) => {
    const trimmedEmail = (email ?? "").trim();
    const trimmedUserName = (userName ?? "").trim();

    if (!trimmedEmail) throw new Error("Email is required to sign up.");
    if (!trimmedUserName) throw new Error("Username is required to sign up.");
    if (!password) throw new Error("Password is required to sign up.");

    setLoading(true);
    try {
      const u = await withTimeout(
        signUp({ email: trimmedEmail, password, username: trimmedUserName }),
        8000,
        "signUp"
      );
      if (mountedRef.current) setUser(u);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, refresh, loginUser, logoutUser, registerUser }),
    [user, loading, refresh, loginUser, logoutUser, registerUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
