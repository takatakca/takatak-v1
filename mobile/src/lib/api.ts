// Client for the TAKATAK native app API (takatak-v1/src/app/api/mobile/v1). Sign-in uses the website's own email
// code (POST /api/auth/email-code), then /api/mobile/v1/auth/verify returns the session tokens. They live only in the
// phone's secure storage (Keychain / Keystore) and travel as "Authorization: Bearer". The access token is refreshed
// a minute before it expires, and once more after a 401, before the person is asked to sign in again.
import * as SecureStore from 'expo-secure-store';
import { SITE_ORIGIN } from './config';
import type * as T from './types';

const SESSION_KEY = 'tk.session.v1';
const WORKSPACE_KEY = 'tk.workspace.v1';
const REVIEW_TOKEN = 'review';
let session: T.Session | null = null;
let workspaceId: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Visual preview with fictitious data (src/lib/demo.ts), never on in a store build.
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

const secure = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function loadSession(): Promise<boolean> {
  if (DEMO) { session = { accessToken: 'demo', refreshToken: 'demo', expiresAt: 4102444800 }; return true; }
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    session = raw ? (JSON.parse(raw) as T.Session) : null;
    workspaceId = await SecureStore.getItemAsync(WORKSPACE_KEY);
  } catch { session = null; }
  applyMode();
  return Boolean(session?.accessToken && session.refreshToken);
}

async function saveSession(value: T.Session | null) {
  session = value;
  if (value) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value), secure);
  else {
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(WORKSPACE_KEY).catch(() => undefined);
    workspaceId = null;
  }
}

export async function setWorkspace(id: string | null) {
  workspaceId = id;
  if (id) await SecureStore.setItemAsync(WORKSPACE_KEY, id, secure);
  else await SecureStore.deleteItemAsync(WORKSPACE_KEY).catch(() => undefined);
}

export function setUnauthorizedHandler(handler: (() => void) | null) { onUnauthorized = handler; }

async function send(method: string, path: string, body?: unknown, auth = true): Promise<{ response: Response; data: any }> {
  const headers: Record<string, string> = { Accept: 'application/json', Origin: SITE_ORIGIN };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session) headers.Authorization = `Bearer ${session.accessToken}`;
  if (auth && workspaceId) headers['x-takatak-workspace'] = workspaceId;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
    response = await fetch(`${SITE_ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', signal: controller.signal });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Connexion impossible. Vérifiez votre accès Internet et réessayez.');
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  let data: any = null;
  if (text) { try { data = JSON.parse(text); } catch { data = null; } }
  return { response, data };
}

async function refreshSession(): Promise<boolean> {
  if (!session) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const { response, data } = await send('POST', '/api/mobile/v1/auth/refresh', { refreshToken: session!.refreshToken }, false);
        if (response.ok && data?.session) { await saveSession(data.session); return true; }
        if (response.status === 401) { await saveSession(null); onUnauthorized?.(); }
        return false;
      } catch { return false; } finally { refreshing = null; }
    })();
  }
  return refreshing;
}

function messageFor(status: number) {
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous.';
  if (status === 403) return 'Votre rôle ne permet pas cette action.';
  if (status === 404) return 'Élément introuvable.';
  if (status === 409) return 'Choisissez une entreprise pour continuer.';
  if (status === 429) return 'Trop de tentatives. Réessayez dans un instant.';
  if (status >= 500) return 'Le service est momentanément indisponible.';
  return 'La demande n’a pas abouti.';
}

async function request<R>(method: string, path: string, body?: unknown, auth = true): Promise<R> {
  if (auth && session && session.expiresAt - Date.now() / 1000 < 60) await refreshSession();
  let { response, data } = await send(method, path, body, auth);
  if (auth && response.status === 401 && session && (await refreshSession())) {
    ({ response, data } = await send(method, path, body, auth));
  }
  if (!response.ok) {
    if (auth && response.status === 401) { await saveSession(null); onUnauthorized?.(); }
    throw new ApiError(response.status, data?.code ?? `HTTP_${response.status}`, data?.message ?? messageFor(response.status));
  }
  return data as R;
}

export const api = {
  requestCode: (email: string) => request<{ ok: boolean; message: string }>('POST', '/api/auth/email-code', { email }, false),
  // Store reviewer email? Then no email is sent: the reviewer types the code given in the store console.
  // An older server without this route answers 404: treated as a normal email.
  isReviewEmail: async (email: string) => {
    try { return (await request<{ review?: boolean }>('POST', '/api/mobile/v1/auth/review', { email }, false)).review === true; } catch { return false; }
  },
  verifyCode: async (email: string, code: string) => {
    const result = await request<{ session: T.Session; user: { id: string; email: string } }>('POST', '/api/mobile/v1/auth/verify', { email, code }, false);
    await saveSession(result.session);
    applyMode();
    return result;
  },
  signOut: async () => { await saveSession(null); applyMode(); },
  hasSession: () => Boolean(session),

  me: () => request<T.Me>('GET', '/api/mobile/v1/me'),
  home: () => request<T.Home>('GET', '/api/mobile/v1/home'),
  notifications: () => request<{ notifications: T.Notification[]; unread: number }>('GET', '/api/mobile/v1/notifications'),
  markRead: (target: { all: true } | { ids: string[] }) => request<{ updated: number }>('POST', '/api/mobile/v1/notifications/read', target),
  invoices: () => request<T.Invoices>('GET', '/api/mobile/v1/invoices'),
  leads: () => request<T.Leads>('GET', '/api/mobile/v1/leads'),
  web: () => request<T.Web>('GET', '/api/mobile/v1/web'),
  team: () => request<T.Team>('GET', '/api/mobile/v1/team'),
};

// Fictitious data instead of the server: the visual preview (DEMO) and the store reviewer session, whose token
// ("review") no real /api/mobile/v1 route accepts. Everything else always talks to the real server.
const realApi = { ...api };
export const isReviewSession = () => session?.accessToken === REVIEW_TOKEN;
function applyMode() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Object.assign(api, realApi, DEMO || isReviewSession() ? require('./demo').demoApi : {});
}
applyMode();
