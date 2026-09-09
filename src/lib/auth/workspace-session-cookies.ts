import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { ACTIVE_CLIENT_COOKIE } from "@/lib/security/access-context";
import { ACTIVE_BRAND_COOKIE } from "@/lib/security/brand-context";

export type SessionCookieWrite = {
  name: string;
  value: string;
  options?: object;
};

const WORKSPACE_COOKIE_NAMES = [
  ACTIVE_CLIENT_COOKIE,
  ACTIVE_BRAND_COOKIE,
] as const;

const CLEARED_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 0,
};

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

export function expireAuthCookies(
  existingNames: string[],
): SessionCookieWrite[] {
  return authCookieNamesToExpire(existingNames).map((name) => ({
    name,
    value: "",
    options: CLEARED_COOKIE,
  }));
}

export function workspaceCookieClears(): SessionCookieWrite[] {
  return WORKSPACE_COOKIE_NAMES.map((name) => ({
    name,
    value: "",
    options: CLEARED_COOKIE,
  }));
}

export function applySessionCookies(
  response: NextResponse,
  writes: SessionCookieWrite[],
): void {
  for (const write of writes) {
    response.cookies.set(write.name, write.value, write.options as never);
  }
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
