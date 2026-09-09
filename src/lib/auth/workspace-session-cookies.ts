import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import {
  AUTH_IDENTITY_COOKIE,
  AUTH_VERIFIED_AT_COOKIE,
} from "@/lib/security/authenticated-identity";
import { ACTIVE_CLIENT_COOKIE } from "@/lib/security/access-context";
import { ACTIVE_BRAND_COOKIE } from "@/lib/security/brand-context";

export type SessionCookieWrite = {
  name: string;
  value: string;
  options?: SessionCookieOptions;
};

export type SessionCookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
  priority?: "low" | "medium" | "high";
};

export type ApplyCookiesResult =
  | { ok: true; cookieCount: number; headerBytes: number }
  | { ok: false; message: string; cookieCount: number; headerBytes: number };

const TENANT_COOKIE_NAMES = [
  ACTIVE_CLIENT_COOKIE,
  ACTIVE_BRAND_COOKIE,
] as const;

const WORKSPACE_COOKIE_NAMES = [
  ...TENANT_COOKIE_NAMES,
  AUTH_IDENTITY_COOKIE,
  AUTH_VERIFIED_AT_COOKIE,
] as const;

/** Apache/Passenger request-header budget is often 8 KiB. Stay well below. */
export const MAX_SET_COOKIE_HEADER_BYTES = 7_000;
export const MAX_SET_COOKIE_COUNT = 40;

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function productionCookieDefaults(
  options?: SessionCookieOptions,
): SessionCookieOptions {
  const sameSite = options?.sameSite ?? "lax";
  return {
    ...options,
    httpOnly: options?.httpOnly ?? true,
    sameSite,
    secure:
      options?.secure ??
      (isProductionRuntime() || sameSite === "none"),
    path: options?.path ?? "/",
  };
}

function clearedCookie(): SessionCookieOptions {
  return productionCookieDefaults({
    maxAge: 0,
    expires: new Date(0),
  });
}

function isAuthTokenCookie(name: string): boolean {
  return name.includes("-auth-token");
}

function authCookieNamesToExpire(existingNames: string[]): string[] {
  const names = new Set<string>();

  for (const name of existingNames) {
    if (!isAuthTokenCookie(name)) continue;
    const base = name.replace(/\.\d+$/, "");
    names.add(base);
    for (let index = 0; index < 10; index += 1) {
      names.add(`${base}.${index}`);
    }
  }

  return [...names];
}

export function expireNamedCookies(names: string[]): SessionCookieWrite[] {
  return [...new Set(names)].map((name) => ({
    name,
    value: "",
    options: clearedCookie(),
  }));
}

export function expireAuthCookies(
  existingNames: string[],
): SessionCookieWrite[] {
  return expireNamedCookies(authCookieNamesToExpire(existingNames));
}

export function workspaceCookieClears(): SessionCookieWrite[] {
  return WORKSPACE_COOKIE_NAMES.map((name) => ({
    name,
    value: "",
    options: clearedCookie(),
  }));
}

export function staleTenantCookieClears(): SessionCookieWrite[] {
  return TENANT_COOKIE_NAMES.map((name) => ({
    name,
    value: "",
    options: clearedCookie(),
  }));
}

export function identitySessionCookies(
  authUserId: string,
  verifiedAt = Date.now(),
): SessionCookieWrite[] {
  return [
    {
      name: AUTH_IDENTITY_COOKIE,
      value: authUserId,
      options: productionCookieDefaults({
        maxAge: 60 * 60 * 24 * 7,
      }),
    },
    {
      name: AUTH_VERIFIED_AT_COOKIE,
      value: String(verifiedAt),
      options: productionCookieDefaults({
        maxAge: 60 * 5,
      }),
    },
  ];
}

export function estimateCookieHeaderBytes(writes: SessionCookieWrite[]): number {
  return writes.reduce((total, write) => {
    const options = write.options ?? {};
    const parts = [`${write.name}=${write.value}`, `Path=${options.path ?? "/"}`];
    if (options.maxAge !== undefined) {
      parts.push(`Max-Age=${options.maxAge}`);
    }
    if (options.httpOnly) {
      parts.push("HttpOnly");
    }
    if (options.secure) {
      parts.push("Secure");
    }
    if (options.sameSite) {
      parts.push(`SameSite=${options.sameSite}`);
    }
    return total + parts.join("; ").length + 2;
  }, 0);
}

export function normalizeSessionCookieWrites(
  writes: SessionCookieWrite[],
): SessionCookieWrite[] {
  const byName = new Map<string, SessionCookieWrite>();
  for (const write of writes) {
    byName.set(write.name, {
      name: write.name,
      value: write.value,
      options: productionCookieDefaults(write.options),
    });
  }
  return [...byName.values()];
}

export function applySessionCookies(
  response: NextResponse,
  writes: SessionCookieWrite[],
): ApplyCookiesResult {
  const normalized = normalizeSessionCookieWrites(writes);
  const headerBytes = estimateCookieHeaderBytes(normalized);
  const cookieCount = normalized.length;

  if (cookieCount > MAX_SET_COOKIE_COUNT || headerBytes > MAX_SET_COOKIE_HEADER_BYTES) {
    console.error(
      "[session-cookies] Set-Cookie budget exceeded",
      `count=${cookieCount}`,
      `bytes=${headerBytes}`,
    );
    return {
      ok: false,
      message: "Unable to start a session. Please try again.",
      cookieCount,
      headerBytes,
    };
  }

  try {
    for (const write of normalized) {
      response.cookies.set(
        write.name,
        write.value,
        write.options as never,
      );
    }
  } catch {
    console.error("[session-cookies] Failed to apply authentication cookies");
    return {
      ok: false,
      message: "Unable to start a session. Please try again.",
      cookieCount,
      headerBytes,
    };
  }

  return { ok: true, cookieCount, headerBytes };
}

export function clearWorkspaceCookiesOnResponse(response: NextResponse): void {
  applySessionCookies(response, workspaceCookieClears());
}

export async function clearWorkspaceCookiesFromStore(): Promise<void> {
  const jar = await cookies();
  for (const name of WORKSPACE_COOKIE_NAMES) {
    jar.delete(name);
  }
}
