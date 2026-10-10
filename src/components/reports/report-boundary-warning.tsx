import { TriangleAlert } from "lucide-react";

/** Phase 10 boundary made visible on reporting pages. */
export function ReportBoundaryWarning() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <p className="text-xs leading-relaxed text-amber-800">
        PDF export and in-dashboard delivery are available for a saved report in this workspace.
        Public share links, email delivery, provider analytics sync, and AI-generated summaries stay off.
      </p>
    </div>
  );
}
