import { ApprovalCard } from "@/components/social/approval-card";
import { SocialEmptyState } from "@/components/social/social-empty-state";
import { SocialHeader } from "@/components/social/social-header";
import { SourceBanner } from "@/components/social/source-banner";
import { APPROVAL_STATUS_LABELS } from "@/lib/social/status";
import { getSocialApprovalsData } from "@/lib/social/social-data";

export const dynamic = "force-dynamic";

const SECTIONS = ["pending", "approved", "rejected", "changes_requested", "cancelled"] as const;

export default async function SocialApprovalsPage() {
  const data = await getSocialApprovalsData();
  return (
    <div className="space-y-5">
      <SocialHeader
        title="Approvals"
        subtitle="Client approval workflow for posts. Approve/reject actions and notifications activate in a later phase."
        badges={[{ label: "Foundation" }]}
      />
      <SourceBanner source={data.source} label={data.sourceLabel} />
      {data.approvals.length ? (
        SECTIONS.map((status) => {
          const items = data.approvals.filter((a) => a.status === status);
          if (!items.length) return null;
          return (
            <section key={status} className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">{APPROVAL_STATUS_LABELS[status]}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((a) => <ApprovalCard key={a.id} approval={a} />)}
              </div>
            </section>
          );
        })
      ) : (
        <SocialEmptyState title="No approvals yet" description="Approval requests appear here when posts are submitted for review." />
      )}
    </div>
  );
}
