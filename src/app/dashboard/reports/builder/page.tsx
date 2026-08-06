import { Sparkles } from "lucide-react";
import { ReportBoundaryWarning } from "@/components/reports/report-boundary-warning";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportSourceBanner } from "@/components/reports/source-banner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getReportBuilderData } from "@/lib/reports/reporting-data";

export const dynamic = "force-dynamic";

const BUILDER_SECTIONS = [
  "Executive Summary",
  "Service Status",
  "Social Media Snapshot",
  "Web / Hosting Snapshot",
  "Recommendations",
];

export default async function ReportBuilderPage() {
  const data = await getReportBuilderData();
  return (
    <div className="space-y-5">
      <ReportHeader
        title="Report Builder"
        subtitle="Visual report builder foundation. Selectors and generation activate in a later phase — this page performs no generation."
        badges={[{ label: "Foundation", status: "draft" }, { label: "Coming soon" }]}
      />
      <ReportSourceBanner source={data.source} label={data.sourceLabel} />

      <Card>
        <CardHeader title="Build a report (visual only)" subtitle="All controls are disabled placeholders in Phase 10." />
        <CardBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {["Client", "Brand", "Report type"].map((label) => (
              <div key={label}>
                <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
                <select disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                  <option>Select {label.toLowerCase()}</option>
                </select>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Sections preview</p>
            <ol className="space-y-1.5">
              {BUILDER_SECTIONS.map((s, i) => (
                <li key={s} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700">
                  {i + 1}. {s}
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-400 ring-1 ring-inset ring-slate-200"
          >
            <Sparkles className="h-4 w-4" />
            Generate report
            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Coming soon</span>
          </button>
          <p className="text-[11px] text-slate-400">Builder is visual only in Phase 10.</p>
        </CardBody>
      </Card>

      <ReportBoundaryWarning />
    </div>
  );
}
