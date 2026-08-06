import { PlugZap, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

const FUTURE_FUNCTIONS = [
  "Local listing sync",
  "Local directory visibility",
  "Citations",
  "Reviews",
  "Photos",
  "Local SEO visibility",
  "Business profile optimization",
];

/** Honest QMAPS preparation panel — nothing is connected. */
export function QmapsPrepPanel() {
  return (
    <Card>
      <CardHeader
        title="QMAPS Preparation"
        subtitle="QMAPS becomes the local listings engine in a future phase. Nothing is connected yet."
        action={<Badge tone="warning">Not connected</Badge>}
      />
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <PlugZap className="h-4 w-4 text-slate-400" />
          Requires QMAPS_API_KEY (env var — name only, no value stored in code).
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {FUTURE_FUNCTIONS.map((fn) => (
            <div key={fn} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700">
              {fn} <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">· After verified connection</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-relaxed text-amber-800">
            No QMAPS, Google Business, citation scan, review import, listing publishing, or provider sync is active in Phase 11.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
