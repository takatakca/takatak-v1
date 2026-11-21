import "server-only";

// Follows a link hop by hop, like a browser, and records each step. Every
// request goes to an address resolved and checked as public first (the SEO
// site audit's SSRF guards). Nothing is stored.
import { normalizeAuditUrl, requestPinned, resolvePublicAddress } from "@/lib/seo/site-audit";

import { gradeRedirects, type RedirectHop, type RedirectReport } from "./redirect-grade";

const MAX_HOPS = 10;
const TIMEOUT_MS = 8_000;
const USER_AGENT = "TAKATAK-RedirectCheck/1.0 (+https://takatak.ca)";

export type RedirectCheckResult = { ok: true; report: RedirectReport } | { ok: false; error: string };

export async function runRedirectCheck(raw: string): Promise<RedirectCheckResult> {
  let current: URL;
  try {
    current = normalizeAuditUrl(raw);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Adresse invalide · Invalid address." };
  }
  const start = current.toString();
  const hops: RedirectHop[] = [];
  const seen = new Set<string>();
  for (let step = 0; step <= MAX_HOPS; step += 1) {
    if (seen.has(current.toString())) return { ok: true, report: gradeRedirects(start, hops, "loop") };
    seen.add(current.toString());
    let status: number;
    let location: string | null;
    try {
      const pinned = await resolvePublicAddress(current);
      const response = await requestPinned(current, pinned, { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.5" }, TIMEOUT_MS);
      response.body.destroy();
      status = response.status;
      const header = response.headers.location;
      location = (Array.isArray(header) ? header[0] : header) ?? null;
    } catch {
      return { ok: true, report: gradeRedirects(start, hops, "unreachable") };
    }
    const next = status >= 300 && status < 400 && location ? new URL(location, current) : null;
    hops.push({ url: current.toString(), status, location: next ? next.toString() : null });
    if (!next) return { ok: true, report: gradeRedirects(start, hops, null) };
    try {
      current = normalizeAuditUrl(next.toString());
    } catch {
      return { ok: true, report: gradeRedirects(start, hops, "unreachable") };
    }
  }
  return { ok: true, report: gradeRedirects(start, hops, "too_many") };
}
