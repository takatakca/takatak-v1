// Client IP for anonymous rate limits and analytics visitor hashing.
//
// X-Forwarded-For is client-controlled except for the entries our own proxies
// append, so the leftmost value can be forged. Each trusted proxy appends the
// address it received the request from; the client is therefore the entry
// TRUSTED_PROXY_HOPS positions from the right (default 1: one proxy such as
// Vercel's edge or Coolify/Traefik; use 2 for Cloudflare in front of Traefik).
// When the platform sets a dedicated trusted header (e.g. cf-connecting-ip),
// name it in CLIENT_IP_HEADER and it is used instead.

export function trustedProxyHops(env: Record<string, string | undefined> = process.env): number {
  const hops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "1", 10);
  return Number.isInteger(hops) && hops >= 1 && hops <= 5 ? hops : 1;
}

export function clientIpFromHeaders(headers: Headers, env: Record<string, string | undefined> = process.env): string | null {
  const dedicated = env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (dedicated && /^[a-z0-9-]{1,64}$/.test(dedicated)) {
    const value = headers.get(dedicated)?.split(",")[0]?.trim();
    return value || null;
  }
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  // No X-Forwarded-For at all: proxies that only set X-Real-IP (as before).
  if (chain.length === 0) return headers.get("x-real-ip")?.trim() || null;
  const hops = trustedProxyHops(env);
  // Fewer entries than hops: the request did not pass through every proxy;
  // the leftmost is then the best available (and is no worse than before).
  return chain[Math.max(chain.length - hops, 0)] ?? null;
}
