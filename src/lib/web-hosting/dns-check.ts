import "server-only";

// Public DNS lookups for one domain (read-only). Uses the server's resolver
// with a short timeout; only record values are read, nothing is stored.
import { Resolver } from "node:dns/promises";

import { gradeDns, type DnsReport } from "./dns-grade";

const TIMEOUT_MS = 4_000;
const DOMAIN_RE = /^(?=.{3,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

export type DnsCheckResult = { ok: true; report: DnsReport } | { ok: false; error: string };

/** "https://www.Example.ca/page" → "example.ca"; null when it is not a public domain name. */
export function domainFrom(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 300) return null;
  let host = trimmed;
  try {
    host = new URL(/^[a-z]+:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  return DOMAIN_RE.test(host) && !host.endsWith(".local") && !host.endsWith(".internal") ? host : null;
}

async function safe<T>(lookup: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await lookup();
  } catch {
    return fallback;
  }
}

export async function runDnsCheck(raw: string): Promise<DnsCheckResult> {
  const domain = domainFrom(raw);
  if (!domain) return { ok: false, error: "Entrez un nom de domaine public, ex. votresite.ca · Enter a public domain name." };
  const resolver = new Resolver({ timeout: TIMEOUT_MS, tries: 2 });
  const [a, aaaa, ns, mx, txt, dmarc, wwwA, wwwCname] = await Promise.all([
    safe(() => resolver.resolve4(domain), [] as string[]),
    safe(() => resolver.resolve6(domain), [] as string[]),
    safe(() => resolver.resolveNs(domain), [] as string[]),
    safe(() => resolver.resolveMx(domain), [] as Array<{ exchange: string; priority: number }>),
    safe(async () => (await resolver.resolveTxt(domain)).map((parts) => parts.join("")), [] as string[]),
    safe(async () => (await resolver.resolveTxt(`_dmarc.${domain}`)).map((parts) => parts.join("")), [] as string[]),
    safe(() => resolver.resolve4(`www.${domain}`), [] as string[]),
    safe(() => resolver.resolveCname(`www.${domain}`), [] as string[]),
  ]);
  if (!a.length && !aaaa.length && !ns.length && !mx.length && !txt.length) {
    return { ok: false, error: `Aucun enregistrement trouvé pour ${domain} · No record found for ${domain}.` };
  }
  return {
    ok: true,
    report: gradeDns({ domain, a, aaaa, ns, mx, txt: txt.slice(0, 20), dmarc: dmarc.slice(0, 5), wwwResolves: wwwA.length > 0 || wwwCname.length > 0 }),
  };
}
