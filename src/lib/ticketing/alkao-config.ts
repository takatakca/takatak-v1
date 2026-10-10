/**
 * ALKAO (the TAKATAK Ticket Hub) runs as its own deployment. The dashboard
 * frames its Operations app at `${origin}/ops` and hands it the signed-in
 * user's access token by postMessage (see components/ticketing/alkao-frame).
 *
 * ALKAO_OPS_URL is read at request time, on the server. Only its origin is
 * kept. It must be HTTPS; plain http is accepted for localhost outside
 * production. ALKAO must list this dashboard's origin in its
 * ALKAO_OPS_FRAME_ANCESTORS, or it refuses to be framed.
 */
export function parseAlkaoOpsOrigin(
  value: string | undefined,
  production: boolean,
): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const local =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !(local && !production)) return null;
  return url.origin;
}

export function getAlkaoOpsOrigin(): string | null {
  return parseAlkaoOpsOrigin(
    process.env.ALKAO_OPS_URL,
    process.env.NODE_ENV === "production",
  );
}

/** Messages exchanged with the embedded ALKAO Operations app. */
export const ALKAO_MESSAGES = {
  ready: "alkao.ready",
  sessionExpired: "alkao.session_expired",
  session: "alkao.session",
} as const;
