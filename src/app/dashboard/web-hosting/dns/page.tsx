import { DnsRecordList } from "@/components/web-hosting/dns-record-list";
import { WebHostingEmptyState } from "@/components/web-hosting/web-hosting-empty-state";
import { WebHostingHeader } from "@/components/web-hosting/web-hosting-header";
import { WebSourceBanner } from "@/components/web-hosting/source-banner";
import { getDnsRecordsData } from "@/lib/web-hosting/web-hosting-data";
import { StaffOnly } from "@/components/dashboard/staff-only";

export const dynamic = "force-dynamic";

async function DnsPageScreen() {
  const data = await getDnsRecordsData();
  return (
    <div className="space-y-5">
      <WebHostingHeader
        title="DNS"
        subtitle="Internal DNS tracking. Values marked Internal demo are foundation placeholders — nothing here is live, and editing arrives with provider sync."
        badges={[{ label: "Foundation" }, { label: "Internal demo" }]}
      />
      <WebSourceBanner source={data.source} label={data.sourceLabel} />
      {data.records.length ? (
        <DnsRecordList records={data.records} />
      ) : (
        <WebHostingEmptyState title="No DNS records yet" description="DNS tracking rows appear here." />
      )}
    </div>
  );
}

// Not self-serve for clients yet: TAKATAK staff see the screen, clients see
// what it is for and ask the team (owner's order, Nov 2026: no prototypes).
export default async function DnsPage() {
  return (
    <StaffOnly
      title="DNS"
      purpose="Les enregistrements DNS de vos domaines · The DNS records of your domains."
    >
      <DnsPageScreen />
    </StaffOnly>
  );
}
