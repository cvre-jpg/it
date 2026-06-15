import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type AdminRole, type AdminUser, verifyAdminLogin } from "@/lib/admin-auth";

type AuthCtx = {
  user: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  role: AdminRole | null;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const STORAGE_KEY = "shopict_admin_session";
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000;

type StoredAdminSession = {
  user: AdminUser;
  expiresAt: number;
};

function readStoredValue(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage permission and quota issues.
  }
}

function removeStoredValue(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage permission and quota issues.
  }
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  isAdmin: false,
  role: null,
  isSuperAdmin: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = readStoredValue(STORAGE_KEY);
      if (raw) {
        const parsed = normalizeStoredSession(JSON.parse(raw));
        if (parsed) {
          setUser(parsed.user);
          setSessionExpiresAt(parsed.expiresAt);
          writeStoredValue(STORAGE_KEY, JSON.stringify(parsed));
        } else {
          removeStoredValue(STORAGE_KEY);
        }
      }
    } catch {
      removeStoredValue(STORAGE_KEY);
    } finally {
      setLoading(false);
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (!event.newValue) {
        setUser(null);
        setSessionExpiresAt(null);
        return;
      }

      try {
        const parsed = normalizeStoredSession(JSON.parse(event.newValue));
        setUser(parsed?.user ?? null);
        setSessionExpiresAt(parsed?.expiresAt ?? null);
      } catch {
        setUser(null);
        setSessionExpiresAt(null);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!sessionExpiresAt) return;

    const remainingMs = sessionExpiresAt - Date.now();
    if (remainingMs <= 0) {
      setUser(null);
      setSessionExpiresAt(null);
      removeStoredValue(STORAGE_KEY);
      return;
    }

    const timeout = window.setTimeout(() => {
      setUser(null);
      setSessionExpiresAt(null);
      removeStoredValue(STORAGE_KEY);
    }, remainingMs);

    return () => window.clearTimeout(timeout);
  }, [sessionExpiresAt]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      isAdmin: Boolean(user),
      role: user?.role ?? null,
      isSuperAdmin: user?.role === "super_admin",
      signIn: async (email, password) => {
        const adminUser = await verifyAdminLogin(email, password);
        const session = createStoredSession(adminUser);
        setUser(adminUser);
        setSessionExpiresAt(session.expiresAt);
        writeStoredValue(STORAGE_KEY, JSON.stringify(session));
      },
      signOut: async () => {
        setUser(null);
        setSessionExpiresAt(null);
        removeStoredValue(STORAGE_KEY);
      },
    }),
    [loading, user],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

function createStoredSession(user: AdminUser): StoredAdminSession {
  return {
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

function normalizeStoredSession(value: unknown): StoredAdminSession | null {
  if (!value || typeof value !== "object") return null;

  const maybeSession = value as Partial<StoredAdminSession>;
  if ("user" in maybeSession || "expiresAt" in maybeSession) {
    if (typeof maybeSession.expiresAt !== "number" || maybeSession.expiresAt <= Date.now()) {
      return null;
    }
    const user = normalizeStoredUser(maybeSession.user);
    return user ? { user, expiresAt: maybeSession.expiresAt } : null;
  }

  const legacyUser = normalizeStoredUser(value);
  return legacyUser ? createStoredSession(legacyUser) : null;
}

function normalizeStoredUser(value: unknown): AdminUser | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<AdminUser>;
  const email = typeof candidate.email === "string" ? candidate.email : "";
  const name = typeof candidate.name === "string" ? candidate.name : "Administrator";
  const role: AdminRole =
    candidate.role === "super_admin" ? "super_admin" : candidate.role === "attendant" ? "attendant" : "admin";

  if (!email) return null;

  return {
    email,
    name,
    role,
    isAdmin: true,
  };
}
