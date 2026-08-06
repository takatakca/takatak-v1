import { DnsRecordList } from "@/components/web-hosting/dns-record-list";
import { WebHostingEmptyState } from "@/components/web-hosting/web-hosting-empty-state";
import { WebHostingHeader } from "@/components/web-hosting/web-hosting-header";
import { WebSourceBanner } from "@/components/web-hosting/source-banner";
import { getDnsRecordsData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function DnsPage() {
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
