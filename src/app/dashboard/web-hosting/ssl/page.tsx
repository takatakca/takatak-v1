import { SslCertificateCard } from "@/components/web-hosting/ssl-certificate-card";
import { WebHostingEmptyState } from "@/components/web-hosting/web-hosting-empty-state";
import { WebHostingHeader } from "@/components/web-hosting/web-hosting-header";
import { WebSourceBanner } from "@/components/web-hosting/source-banner";
import { getSslCertificatesData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function SslPage() {
  const data = await getSslCertificatesData();
  return (
    <div className="space-y-5">
      <WebHostingHeader
        title="SSL"
        subtitle="SSL certificate tracking. No installation actions exist yet — real SSL work arrives with the Upmind/provider phase."
        badges={[{ label: "Foundation" }, { label: "Internal demo" }]}
      />
      <WebSourceBanner source={data.source} label={data.sourceLabel} />
      {data.certificates.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.certificates.map((c) => <SslCertificateCard key={c.id} cert={c} />)}
        </div>
      ) : (
        <WebHostingEmptyState title="No SSL certificates tracked" description="SSL tracking rows appear here." />
      )}
    </div>
  );
}
