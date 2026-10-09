import "server-only";

import { headers } from "next/headers";

/** Public origin of this TAKATAK deployment, for embed snippets and share links. */
export async function publicAppOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\/[^/]+$/.test(configured)) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
