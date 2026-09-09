import "server-only";

import { createServerClient } from "@supabase/ssr";

import { createAuthErrorId } from "@/lib/auth/auth-error-id";
import { getSupabaseEnv } from "@/lib/auth/env";
import { normalizeEmail } from "@/lib/auth/registration-validation";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import {
  expireAuthCookies,
  identitySessionCookies,
  workspaceCookieClears,
  type SessionCookieWrite,
} from "@/lib/auth/workspace-session-cookies";
import { logAuthFailure } from "@/lib/auth/auth-json";
import { redactSecrets } from "@/lib/security/redact";

const AUTH_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SESSION_UNAVAILABLE_MESSAGE =
  "Unable to start a session. Please try again.";

export type SessionStage =
  | "configuration"
  | "auth_user_validation"
  | "confirm_email"
  | "generate_link"
  | "cookie_preparation"
  | "local_signout"
  | "verify_magiclink"
  | "session_validation";

export type CreateSessionResult =
  | { ok: true; cookies: SessionCookieWrite[] }
  | { ok: false; message: string; stage: SessionStage; errorId: string };

export type SessionCookieSnapshot = {
  name: string;
  value?: string;
};

type AdminAuth = {
  auth: {
    admin: {
      getUserById: (id: string) => Promise<{
        data: { user: { id: string; email?: string | null } | null };
        error: { message?: string } | null;
      }>;
      updateUserById: (
        id: string,
        attributes: { email_confirm: boolean },
      ) => Promise<{ error: { message?: string } | null }>;
      generateLink: (args: {
        type: "magiclink";
        email: string;
      }) => Promise<{
        data: { properties?: { hashed_token?: string | null } | null };
        error: { message?: string } | null;
      }>;
    };
  };
};

type BrowserAuth = {
  auth: {
    signOut: (args: { scope: "local" }) => Promise<{
      error: { message?: string } | null;
    }>;
    verifyOtp: (args: {
      type: "magiclink";
      token_hash: string;
    }) => Promise<{
      data: {
        user: { id: string; email?: string | null } | null;
        session: { access_token?: string; user?: { id: string } } | null;
      };
      error: { message?: string } | null;
    }>;
  };
};

export type SessionDependencies = {
  getEnv?: typeof getSupabaseEnv;
  getAdmin?: () => AdminAuth | null;
  createBrowserClient?: (
    url: string,
    anonKey: string,
    writes: SessionCookieWrite[],
    existingCookies: SessionCookieSnapshot[],
  ) => BrowserAuth;
};

function fail(
  stage: SessionStage,
  error?: unknown,
): CreateSessionResult {
  const errorId = createAuthErrorId();
  logAuthFailure("otp-session", stage, errorId, error);
  return {
    ok: false,
    message: SESSION_UNAVAILABLE_MESSAGE,
    stage,
    errorId,
  };
}

export function isValidAuthUserId(authUserId: string): boolean {
  return AUTH_USER_ID_PATTERN.test(authUserId.trim());
}

function defaultCreateBrowserClient(
  url: string,
  anonKey: string,
  writes: SessionCookieWrite[],
  existingCookies: SessionCookieSnapshot[],
): BrowserAuth {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return existingCookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          writes.push({
            name,
            value,
            options: options as SessionCookieWrite["options"],
          });
        });
      },
    },
  }) as unknown as BrowserAuth;
}

export async function createSessionForEmail(
  email: string,
  authUserId: string,
  existingCookies: SessionCookieSnapshot[] = [],
  dependencies: SessionDependencies = {},
): Promise<CreateSessionResult> {
  try {
    const getEnv = dependencies.getEnv ?? getSupabaseEnv;
    const getAdmin =
      dependencies.getAdmin ??
      (() => getSupabaseAdminClient() as AdminAuth | null);
    const createBrowserClient =
      dependencies.createBrowserClient ?? defaultCreateBrowserClient;

    const env = getEnv();
    const admin = getAdmin();
    if (!admin || !env) {
      return fail("configuration");
    }

    const normalizedEmail = normalizeEmail(email);
    if (!authUserId || !isValidAuthUserId(authUserId) || !normalizedEmail) {
      return fail("auth_user_validation");
    }

    let authUser: { id: string; email?: string | null } | null = null;
    try {
      const lookup = await admin.auth.admin.getUserById(authUserId);
      if (lookup.error || !lookup.data.user) {
        return fail("auth_user_validation", lookup.error?.message);
      }
      authUser = lookup.data.user;
    } catch (error) {
      return fail("auth_user_validation", error);
    }

    if (authUser.id !== authUserId) {
      return fail("auth_user_validation");
    }

    const authEmail = normalizeEmail(authUser.email ?? "");
    if (!authEmail || authEmail !== normalizedEmail) {
      return fail("auth_user_validation");
    }

    try {
      const { error: confirmError } = await admin.auth.admin.updateUserById(
        authUserId,
        { email_confirm: true },
      );
      if (confirmError) {
        return fail("confirm_email", confirmError.message);
      }
    } catch (error) {
      return fail("confirm_email", error);
    }

    let hashedToken = "";
    try {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
      });
      hashedToken = data.properties?.hashed_token?.trim() ?? "";
      if (error || !hashedToken) {
        return fail("generate_link", error?.message ?? "missing hashed_token");
      }
    } catch (error) {
      return fail("generate_link", error);
    }

    const writes: SessionCookieWrite[] = [];
    try {
      writes.push(
        ...expireAuthCookies(existingCookies.map((cookie) => cookie.name)),
        ...workspaceCookieClears(),
      );
    } catch (error) {
      return fail("cookie_preparation", error);
    }

    const supabase = createBrowserClient(
      env.url,
      env.anonKey,
      writes,
      existingCookies,
    );

    try {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (signOutError) {
        return fail("local_signout", signOutError.message);
      }
    } catch (error) {
      return fail("local_signout", error);
    }

    let verifiedUser: { id: string; email?: string | null } | null = null;
    let verifiedSession: { access_token?: string; user?: { id: string } } | null =
      null;
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: hashedToken,
      });
      if (verifyError) {
        return fail("verify_magiclink", verifyError.message);
      }
      verifiedUser = data.user;
      verifiedSession = data.session;
    } catch (error) {
      return fail("verify_magiclink", error);
    }

    const sessionUserId =
      verifiedSession?.user?.id ?? verifiedUser?.id ?? "";
    const sessionEmail = normalizeEmail(verifiedUser?.email ?? "");
    if (
      !verifiedUser ||
      !verifiedSession?.access_token ||
      sessionUserId !== authUserId ||
      sessionEmail !== normalizedEmail
    ) {
      return fail("session_validation");
    }

    writes.push(...identitySessionCookies(authUserId));
    return { ok: true, cookies: writes };
  } catch (error) {
    return fail(
      "session_validation",
      error instanceof Error ? redactSecrets(error.message) : error,
    );
  }
}
