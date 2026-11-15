import { CitationAuditWorkbench } from "@/components/local-listings/citation-audit-workbench";
import { getCitationReferenceProfiles } from "@/lib/local-listings/citation-reference-profiles";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";

export const dynamic = "force-dynamic";

export default async function CitationAuditPage() {
  const profiles = await getCitationReferenceProfiles();
  return (
    <div className="space-y-5">
      <LocalListingsHeader
        title="Local Citation Audit"
        subtitle="Check directory citation evidence against your business name, address, phone, and website."
        badges={[{ label: "Private CSV comparison" }, { label: "No provider scans" }]}
      />
      <CitationAuditWorkbench profiles={profiles} />
    </div>
  );
}
