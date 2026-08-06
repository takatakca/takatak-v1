import Link from "next/link";
import { FileBarChart2 } from "lucide-react";
import { SocialEmptyState } from "@/components/social/social-empty-state";
import { SocialHeader } from "@/components/social/social-header";

export const dynamic = "force-dynamic";

export default async function SocialReportsPage() {
  return (
    <div className="space-y-5">
      <SocialHeader
        title="Social Reports"
        subtitle="Weekly, monthly, and campaign reports for clients. The report engine expands in Phase 12; white-label Metricool reports arrive after Phase 6."
        badges={[{ label: "Planned", status: "planned" }]}
      />
      <SocialEmptyState
        icon={FileBarChart2}
        title="No social reports yet"
        description="Draft social reports will appear here once the report engine and Metricool data exist."
      />
      <p className="text-xs text-slate-400">
        Looking for the main report center? <Link href="/dashboard/reports" className="font-medium text-indigo-600 hover:text-indigo-500">Open Reports module →</Link>
      </p>
    </div>
  );
}
