import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/auth/env";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import {
  expireAuthCookies,
  workspaceCookieClears,
  type SessionCookieWrite,
} from "@/lib/auth/workspace-session-cookies";

export async function createSessionForEmail(
  email: string,
  authUserId: string,
): Promise<
  | { ok: true; cookies: SessionCookieWrite[] }
  | { ok: false; message: string }
> {
  const env = getSupabaseEnv();
  const admin = getSupabaseAdminClient();
  const cookieStore = await cookies();

  if (!admin || !env) {
    return {
      ok: false,
      message: "The authentication service is not configured.",
    };
  }

  const { error: confirmError } = await admin.auth.admin.updateUserById(
    authUserId,
    { email_confirm: true },
  );

  if (confirmError) {
    console.error(
      "[otp-session] Could not confirm email:",
      confirmError.message,
    );
    return {
      ok: false,
      message: "Unable to activate this account. Please try again.",
    };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data.properties?.hashed_token) {
    console.error(
      "[otp-session] Could not issue a session link:",
      error?.message ?? "missing hashed_token",
    );
    return {
      ok: false,
      message: "Unable to start a session. Please try again.",
    };
  }

  const writes: SessionCookieWrite[] = [
    ...expireAuthCookies(cookieStore.getAll().map((cookie) => cookie.name)),
    ...workspaceCookieClears(),
  ];

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          writes.push({
            name,
            value,
            options: options as SessionCookieWrite["options"],
          });
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Route handler cookie store can already be committed.
          }
        });
      },
    },
  });

  await supabase.auth.signOut({ scope: "local" });

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });

  if (verifyError) {
    console.error(
      "[otp-session] Session verify failed:",
      verifyError.message,
    );
    return {
      ok: false,
      message: "Unable to start a session. Please try again.",
    };
  }

  return { ok: true, cookies: writes };
}
