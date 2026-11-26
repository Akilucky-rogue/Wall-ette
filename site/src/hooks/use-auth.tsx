import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, signOut: async () => {} });

/** The signed-in Wall·ette account, if any (Firebase Auth, in the browser only). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let active = true;
    void Promise.all([firebaseAuth(), import("firebase/auth")]).then(([auth, m]) => {
      if (!active) return;
      stop = m.onAuthStateChanged(auth, (next) => {
        setUser(next);
        setLoading(false);
      });
    }).catch(() => setLoading(false));
    return () => {
      active = false;
      stop?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signOut: async () => {
      const [auth, m] = await Promise.all([firebaseAuth(), import("firebase/auth")]);
      await m.signOut(auth);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
