import { ProviderGatedModule } from "@/components/growth/provider-gated-module";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getConnectorStatusMap } from "@/lib/growth/status";

export const dynamic = "force-dynamic";

export default async function SeoBacklinksPage() {
  const { showSetupDetails } = await requireGrowthAccess("/dashboard/seo/backlinks");
  const map = getConnectorStatusMap();
  const connectors = ["ahrefs", "semrush", "dataforseo"].flatMap((k) => map.get(k) ?? []);
  return (
    <ProviderGatedModule
      title="Backlinks"
      description="See who links to each client site, catch lost links early and find link-building opportunities from competitors."
      emptyTitle="No backlink data yet"
      emptyBody="Connect Ahrefs, Semrush or DataForSEO to load referring domains, anchors and new/lost link history."
      features={[
        { name: "Referring domains", detail: "Every site linking in, with authority and first-seen date." },
        { name: "New & lost links", detail: "Weekly alerts when important links appear or disappear." },
        { name: "Anchor text mix", detail: "Spot over-optimized or spammy anchor patterns." },
        { name: "Competitor link gap", detail: "Sites linking to competitors but not to the client." },
        { name: "Citation links", detail: "Directory and listing links shared with Local Listings." },
        { name: "Toxic link watch", detail: "Flag risky domains before they hurt rankings." },
      ]}
      connectors={connectors}
      showSetupDetails={showSetupDetails}
    />
  );
}
