import { DomainsManager } from "@/components/web-hosting/domains-manager";
import { getDomainRenewalNotices } from "@/lib/web-hosting/domain-renewal-notices";
import { syncUpmindDomainsForSession } from "@/lib/integrations/upmind/upmind-domain-sync";
import {
  getDnsRecordsData,
  getDomainAssetsData,
  getHostingServicesData,
  getProvisioningTimelineData,
  getSslCertificatesData,
} from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  await syncUpmindDomainsForSession();

  const [domains, hosting, dns, ssl, steps] = await Promise.all([
    getDomainAssetsData(),
    getHostingServicesData(),
    getDnsRecordsData(),
    getSslCertificatesData(),
    getProvisioningTimelineData(),
  ]);

  const liveDomains = domains.domains.filter(
    (domain) => domain.registrar !== "internal_demo",
  );
  const liveNames = new Set(liveDomains.map((domain) => domain.domainName));
  const activity = steps.steps.filter((step) =>
    ["domain_connected", "dns_checked", "ssl_requested", "ssl_ready"].includes(
      step.type,
    ),
  );
  const sourceLabel =
    domains.source === "database"
      ? liveDomains.length
        ? "Upmind — domains recorded from paid or provisioned events."
        : "No Upmind domains yet. Demo placeholders are hidden until a real registration lands."
      : domains.sourceLabel;

  // A server-side opt-in: no notices from demo/fallback data or unverified imports.
  // This read-only card is not the website-wide renewal banner or notification job.
  const renewalNotices =
    process.env.TAKATAK_DOMAIN_RENEWAL_NOTICES_ENABLED === "true"
      ? getDomainRenewalNotices({ source: domains.source, domains: liveDomains })
      : [];

  return (
    <DomainsManager
      domains={liveDomains}
      renewalNotices={renewalNotices}
      hosting={hosting.hostingServices.filter(
        (row) => !row.primaryDomain || liveNames.has(row.primaryDomain),
      )}
      records={dns.records.filter((row) => liveNames.has(row.domainName))}
      certificates={ssl.certificates.filter((row) =>
        liveNames.has(row.domainName),
      )}
      activity={activity.length ? activity : []}
      sourceLabel={sourceLabel}
    />
  );
}
