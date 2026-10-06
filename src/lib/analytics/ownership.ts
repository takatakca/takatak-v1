import "server-only";

// Website ownership — verify a tracked site's domain, then bind Google sources
// to it. The Google service account is shared by every workspace, so linking
// is allowed only for a verified domain and only for sources that belong to
// that domain (Search Console property on the domain, GA4 web stream on it).

import { resolveTxt } from "node:dns/promises";

import { getPrisma } from "@/lib/db/prisma";
import { fetchGa4WebStreamHosts, type GoogleResult } from "@/lib/integrations/google/client";
import { hostMatchesSiteDomain, searchConsolePropertyMatchesDomain } from "@/lib/integrations/google/parse";
import { fetchPublicPage } from "@/lib/seo/site-audit";

import { htmlHasVerificationMeta, txtRecordsHaveVerification } from "./verification";

export interface OwnershipDeps {
  resolveTxt: (host: string) => Promise<string[][]>;
  fetchPage: (url: string) => Promise<{ finalUrl: URL; status: number; body: string } | null>;
  ga4WebStreamHosts: (propertyId: string) => Promise<GoogleResult<string[]>>;
  now: () => Date;
}

const defaultDeps: OwnershipDeps = {
  resolveTxt: (host) => resolveTxt(host),
  fetchPage: fetchPublicPage,
  ga4WebStreamHosts: fetchGa4WebStreamHosts,
  now: () => new Date(),
};

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  return prisma;
}

export type OwnershipResult = { ok: true; method: "dns" | "meta" } | { ok: false; error: string };

export async function verifySiteDomain(clientId: string, siteId: string, deps: OwnershipDeps = defaultDeps): Promise<OwnershipResult> {
  const prisma = requirePrisma();
  const site = await prisma.analyticsSite.findFirst({ where: { id: siteId, clientId }, select: { id: true, domain: true, verificationToken: true } });
  if (!site) return { ok: false, error: "Website not found in this workspace." };

  let method: "dns" | "meta" | null = null;
  try {
    if (txtRecordsHaveVerification(await deps.resolveTxt(site.domain), site.verificationToken)) method = "dns";
  } catch {
    // No TXT records (or DNS failure): fall through to the meta tag.
  }
  if (!method) {
    for (const host of [site.domain, `www.${site.domain}`]) {
      const page = await deps.fetchPage(`https://${host}/`);
      // The page must be served from the site's own domain after redirects.
      if (page && page.status === 200 && page.finalUrl.protocol === "https:" && hostMatchesSiteDomain(page.finalUrl.hostname, site.domain) && htmlHasVerificationMeta(page.body, site.verificationToken)) {
        method = "meta";
        break;
      }
    }
  }
  if (!method) {
    return { ok: false, error: `We could not find this website's verification code on ${site.domain} (DNS TXT record or homepage meta tag). Changes can take a few minutes to appear.` };
  }
  await prisma.analyticsSite.updateMany({ where: { id: site.id, clientId }, data: { domainVerifiedAt: deps.now() } });
  return { ok: true, method };
}

export async function linkVerifiedGoogleSources(
  clientId: string,
  siteId: string,
  links: { ga4PropertyId: string | null; searchConsoleProperty: string | null },
  deps: OwnershipDeps = defaultDeps,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prisma = requirePrisma();
  const site = await prisma.analyticsSite.findFirst({ where: { id: siteId, clientId }, select: { id: true, domain: true, domainVerifiedAt: true } });
  if (!site) return { ok: false, error: "Website not found in this workspace." };
  const clearing = !links.ga4PropertyId && !links.searchConsoleProperty;
  if (!clearing && !site.domainVerifiedAt) return { ok: false, error: `Verify that you own ${site.domain} before connecting Google data.` };

  if (links.searchConsoleProperty && !searchConsolePropertyMatchesDomain(links.searchConsoleProperty, site.domain)) {
    return { ok: false, error: `The Search Console property must be for ${site.domain} (sc-domain:${site.domain} or https://${site.domain}/).` };
  }
  if (links.ga4PropertyId) {
    const streams = await deps.ga4WebStreamHosts(links.ga4PropertyId);
    if (!streams.ok) return { ok: false, error: `Google did not let us read that GA4 property (${streams.reason}). Add the service account as a Viewer first.` };
    if (!streams.data.some((host) => hostMatchesSiteDomain(host, site.domain))) {
      return { ok: false, error: `That GA4 property has no web stream for ${site.domain}.` };
    }
  }

  const result = await prisma.analyticsSite.updateMany({
    where: clearing ? { id: site.id, clientId } : { id: site.id, clientId, domainVerifiedAt: { not: null } },
    data: { ga4PropertyId: links.ga4PropertyId, searchConsoleProperty: links.searchConsoleProperty },
  });
  return result.count === 1 ? { ok: true } : { ok: false, error: "Website not found in this workspace." };
}
