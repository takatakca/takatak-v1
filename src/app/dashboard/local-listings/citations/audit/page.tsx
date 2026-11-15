import { CitationAuditWorkbench } from "@/components/local-listings/citation-audit-workbench";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";

export default function CitationAuditPage() {
  return (
    <div className="space-y-5">
      <LocalListingsHeader
        title="Local Citation Audit"
        subtitle="Check directory citation evidence against your business name, address, phone, and website."
        badges={[{ label: "Private CSV comparison" }, { label: "No provider scans" }]}
      />
      <CitationAuditWorkbench />
    </div>
  );
}
