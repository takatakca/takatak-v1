// Who is signed in, which business (workspace) they are looking at, and the optional Face ID / fingerprint lock.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, loadSession, setUnauthorizedHandler, setWorkspace } from './api';
import type { Me } from './types';

type State = {
  ready: boolean;
  signedIn: boolean;
  me: Me | null;
  lockEnabled: boolean;
  setLockEnabled: (on: boolean) => Promise<void>;
  completeSignIn: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const LOCK_KEY = 'tk.lock.v1';
const SessionContext = createContext<State | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [lockEnabled, setLock] = useState(false);

  const refresh = useCallback(async () => {
    const value = await api.me();
    setMe(value);
    setSignedIn(true);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setSignedIn(false); setMe(null); });
    (async () => {
      setLock((await SecureStore.getItemAsync(LOCK_KEY).catch(() => null)) === 'on');
      if (await loadSession()) {
        // Offline: stay signed in with the stored session; screens show their own retry.
        setSignedIn(true);
        try { await refresh(); } catch { /* handled by the screens */ }
      }
      setReady(true);
    })();
    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const value = useMemo<State>(() => ({
    ready, signedIn, me, lockEnabled,
    setLockEnabled: async on => { setLock(on); await SecureStore.setItemAsync(LOCK_KEY, on ? 'on' : 'off'); },
    completeSignIn: refresh,
    switchWorkspace: async id => { await setWorkspace(id); await refresh(); },
    signOut: async () => { await api.signOut(); setSignedIn(false); setMe(null); },
    refresh,
  }), [ready, signedIn, me, lockEnabled, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider missing');
  return value;
}
