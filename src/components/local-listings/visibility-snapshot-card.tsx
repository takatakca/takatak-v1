import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { VISIBILITY_SOURCE_LABELS, localToneForStatus } from "@/lib/local-listings/status";
import type { LocalVisibilitySnapshotSummary } from "@/lib/local-listings/types";

export function VisibilitySnapshotCard({ snapshot }: { snapshot: LocalVisibilitySnapshotSummary }) {
  const stats = [
    { label: "Listings", value: String(snapshot.listingsCount) },
    { label: "Citations", value: String(snapshot.citationsCount) },
    { label: "Reviews", value: String(snapshot.reviewsCount) },
    { label: "Avg rating", value: snapshot.averageRating != null ? snapshot.averageRating.toFixed(1) : "—" },
    { label: "Score", value: snapshot.score != null ? String(snapshot.score) : "—" },
  ];
  return (
    <Card>
      <CardHeader
        title={snapshot.listingName ?? "Portfolio snapshot"}
        subtitle={`Captured ${snapshot.capturedAt}`}
        action={<Badge tone={localToneForStatus(snapshot.source)}>{VISIBILITY_SOURCE_LABELS[snapshot.source] ?? snapshot.source}</Badge>}
      />
      <CardBody className="space-y-2">
        <div className="grid grid-cols-5 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5 text-center">
              <p className="text-sm font-semibold text-slate-900">{s.value}</p>
              <p className="text-[10px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
        {snapshot.notes ? <p className="text-[11px] leading-relaxed text-slate-400">{snapshot.notes}</p> : null}
      </CardBody>
    </Card>
  );
}
