// Server Supabase client for Server Components and Route Handlers.
// Uses cookie-based sessions per the official @supabase/ssr pattern.
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import {
  AUTH_STATUS_HEADER,
  hasSupabaseAuthCookie,
  readLocalSessionUser,
  resolveAuthUser,
} from "./session-user";

export async function createSupabaseServerClient(options?: {
  persistSessionCookies?: boolean;
}) {
  const env = getSupabaseEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  const persistSessionCookies = options?.persistSessionCookies ?? true;
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (!persistSessionCookies) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Safe to ignore: the proxy refreshes sessions.
        }
      },
    },
  });
}

async function readAuthStatusHeader(): Promise<string | null> {
  try {
    return (await headers()).get(AUTH_STATUS_HEADER);
  } catch {
    return null;
  }
}

/**
 * Returns the authenticated user or null. Never throws on missing config.
 *
 * The proxy already called Auth (`getUser`). Nested layouts must not do that
 * again — a second lookup can time out and look like a sign-out, or race the
 * refresh token and actually clear the session.
 */
export const getSessionUser = cache(async () => {
  const status = await readAuthStatusHeader();
  if (status === "anonymous" || status === "expired") {
    return null;
  }

  const supabase = await createSupabaseServerClient({
    persistSessionCookies: false,
  });
  if (!supabase) return null;

  const cookieStore = await cookies();
  const hasAuthCookie = hasSupabaseAuthCookie(cookieStore.getAll());

  if (status === "authenticated" || status === "network") {
    return hasAuthCookie ? readLocalSessionUser(cookieStore.getAll()) : null;
  }

  const resolution = await resolveAuthUser(supabase, { hasAuthCookie });
  if (resolution.status === "authenticated") {
    return resolution.user;
  }
  if (resolution.status === "network" && hasAuthCookie) {
    return readLocalSessionUser(cookieStore.getAll());
  }
  return null;
});
