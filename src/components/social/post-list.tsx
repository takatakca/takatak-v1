import { DataTable, type Column } from "@/components/saas/data-table";
import { Badge } from "@/components/ui/badge";
import { APPROVAL_STATUS_LABELS, PLATFORM_LABELS, POST_STATUS_LABELS, socialToneForStatus } from "@/lib/social/status";
import type { PostSummary } from "@/lib/social/types";

const columns: Column<PostSummary>[] = [
  {
    key: "post",
    header: "Post",
    render: (p) => (
      <div className="max-w-md">
        <p className="text-slate-800">{p.captionPreview}</p>
        <p className="text-xs text-slate-400">{p.brandName ?? "—"}</p>
      </div>
    ),
  },
  { key: "platform", header: "Platform", render: (p) => <span className="text-xs text-slate-500">{PLATFORM_LABELS[p.platform] ?? p.platform}</span> },
  { key: "campaign", header: "Campaign", render: (p) => <span className="text-xs text-slate-500">{p.campaignName ?? "—"}</span> },
  { key: "status", header: "Status", render: (p) => <Badge tone={socialToneForStatus(p.status)}>{POST_STATUS_LABELS[p.status] ?? p.status}</Badge> },
  { key: "approval", header: "Approval", render: (p) => p.approvalStatus ? <Badge tone={socialToneForStatus(p.approvalStatus)}>{APPROVAL_STATUS_LABELS[p.approvalStatus] ?? p.approvalStatus}</Badge> : <span className="text-xs text-slate-400">—</span> },
  { key: "scheduled", header: "Scheduled", render: (p) => <span className="text-xs text-slate-500">{p.scheduledAt ?? "Unscheduled"}</span> },
];

export function PostList({ posts }: { posts: PostSummary[] }) {
  return <DataTable columns={columns} rows={posts} rowKey={(p) => p.id} caption="Social posts" />;
}
