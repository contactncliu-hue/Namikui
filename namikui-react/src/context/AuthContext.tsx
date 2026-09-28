import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db, usernameToEmailSafe, FAKE_EMAIL_DOMAIN } from '../lib/supabase';
import type { Account, CurrentUser } from '../types';

interface AuthContextValue {
  currentUser: CurrentUser;
  accounts: Account[];
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  createAccount: (username: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ username: null, role: null });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCurrentUserAccount = useCallback(async (): Promise<boolean> => {
    const {
      data: { session },
    } = await db.auth.getSession();
    if (!session) {
      setCurrentUser({ username: null, role: null });
      return false;
    }
    const { data: acc, error } = await db
      .from('accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error || !acc) {
      setCurrentUser({ username: null, role: null });
      return false;
    }
    setCurrentUser({ username: acc.username, role: acc.role });
    return true;
  }, []);

  const refreshAccounts = useCallback(async () => {
    const { data, error } = await db.from('accounts').select('*');
    if (!error && data) setAccounts(data as Account[]);
  }, []);

  useEffect(() => {
    (async () => {
      await loadCurrentUserAccount();
      await refreshAccounts();
      setLoading(false);
    })();
  }, [loadCurrentUserAccount, refreshAccounts]);

  const login = useCallback(
    async (username: string, password: string) => {
      if (!username || !password) {
        return { ok: false as const, message: 'Please fill out both username and password.' };
      }
      const fakeEmail = (await usernameToEmailSafe(username)) + FAKE_EMAIL_DOMAIN;
      const { data: signInData, error: signInError } = await db.auth.signInWithPassword({
        email: fakeEmail,
        password,
      });
      if (signInError || !signInData.session) {
        return { ok: false as const, message: 'Invalid credentials! Check your username and password.' };
      }
      const ok = await loadCurrentUserAccount();
      if (!ok) {
        await db.auth.signOut();
        return { ok: false as const, message: 'Your account could not be found. Please contact an Admin.' };
      }
      await refreshAccounts();
      return { ok: true as const };
    },
    [loadCurrentUserAccount, refreshAccounts]
  );

  const createAccount = useCallback(
    async (username: string, password: string) => {
      if (!username || !password) {
        return { ok: false as const, message: 'Please enter a username and password.' };
      }
      if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
        return { ok: false as const, message: 'Username already exists!' };
      }
      const fakeEmail = (await usernameToEmailSafe(username)) + FAKE_EMAIL_DOMAIN;
      const { error } = await db.auth.signUp({
        email: fakeEmail,
        password,
        options: { data: { username } },
      });
      if (error) {
        return { ok: false as const, message: `Could not create account. Please try again. (${error.message})` };
      }
      return { ok: true as const };
    },
    [accounts]
  );

  const logout = useCallback(async () => {
    await db.auth.signOut();
    setCurrentUser({ username: null, role: null });
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, accounts, loading, login, createAccount, logout, refreshAccounts }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
