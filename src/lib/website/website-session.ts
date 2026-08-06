import "server-only";

import { getSessionUser } from "@/lib/auth/supabase-server";

export interface WebsiteSession {
  isAuthenticated: boolean;
  email: string | null;
}

export async function getWebsiteSession(): Promise<WebsiteSession> {
  try {
    const user = await getSessionUser();

    return {
      isAuthenticated: Boolean(user),
      email: user?.email ?? null,
    };
  } catch (error) {
    console.error(
      "[website-session] Session lookup failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      isAuthenticated: false,
      email: null,
    };
  }
}