import { CitationAuditWorkbench } from "@/components/local-listings/citation-audit-workbench";
import { getCitationReferenceProfiles } from "@/lib/local-listings/citation-reference-profiles";
import { getSavedCitationEvidence } from "@/lib/local-listings/citation-evidence-data";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";

export const dynamic = "force-dynamic";

export default async function CitationAuditPage() {
  const [profiles, savedEvidence] = await Promise.all([
    getCitationReferenceProfiles(), getSavedCitationEvidence(),
  ]);
  return (
    <div className="space-y-5">
      <LocalListingsHeader
        title="Local Citation Audit"
        subtitle="Check directory citation evidence against your business name, address, phone, and website."
        badges={[{ label: "Private CSV comparison" }, { label: "Manual Google check where enabled" }]}
      />
      <CitationAuditWorkbench profiles={profiles} savedEvidence={savedEvidence}
        liveGoogleEnabled={process.env.TAKATAK_LOCAL_CITATION_GBP_LIVE_READ === "true"} />
    </div>
  );
}
