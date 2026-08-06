import { Badge } from "@/components/ui/badge";
import { SECTION_STATUS_LABELS, SECTION_TYPE_LABELS, reportToneForStatus } from "@/lib/reports/status";
import type { ReportSectionSummary } from "@/lib/reports/types";

export function ReportSectionPreview({ sections }: { sections: ReportSectionSummary[] }) {
  return (
    <ol className="space-y-2">
      {sections.map((s) => (
        <li key={s.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-800">{s.order + 1}. {s.title}</p>
            <Badge tone={reportToneForStatus(s.status)}>{SECTION_STATUS_LABELS[s.status] ?? s.status}</Badge>
            <span className="text-[10px] text-slate-400">{SECTION_TYPE_LABELS[s.type] ?? s.type}</span>
          </div>
          {s.contentPreview ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{s.contentPreview}</p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">No content yet.</p>
          )}
        </li>
      ))}
    </ol>
  );
}
