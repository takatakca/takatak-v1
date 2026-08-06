import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { AI_KIND_LABELS, AI_ORIGIN_LABELS, AI_OUTPUT_STATUS_LABELS, aiToneForStatus } from "@/lib/ai/status";
import type { SavedOutputSummary } from "@/lib/ai/types";

export function SavedOutputCard({ output }: { output: SavedOutputSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{output.title}</h3>
            <p className="text-[11px] text-slate-400">
              {AI_KIND_LABELS[output.kind] ?? output.kind} · {output.brandName ?? "—"}
            </p>
          </div>
          <Badge tone={aiToneForStatus(output.origin)}>{AI_ORIGIN_LABELS[output.origin] ?? output.origin}</Badge>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">{output.contentPreview}</p>
        <p className="text-[11px] text-slate-400">
          {AI_OUTPUT_STATUS_LABELS[output.status] ?? output.status} · {output.createdAt}
          {output.voiceName ? ` · Voice: ${output.voiceName}` : ""}
        </p>
      </CardBody>
    </Card>
  );
}
