import { DataTable, type Column } from "@/components/saas/data-table";
import { PublicationActions } from "@/components/social/publication-actions";
import { Badge } from "@/components/ui/badge";
import { PUBLICATION_STATE_LABELS } from "@/lib/social/publishing/publication-model";
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
  {
    key: "publication",
    header: "Publication",
    render: (p) =>
      p.publication?.state ? (
        <span className="text-xs text-slate-600">
          {PUBLICATION_STATE_LABELS[p.publication.state].en}
          {p.publication.permalinkUrl ? (
            <>
              {" · "}
              <a href={p.publication.permalinkUrl} target="_blank" rel="noreferrer" className="underline">
                Open
              </a>
            </>
          ) : null}
        </span>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      ),
  },
];

export function PostList({ posts, canPublish = false }: { posts: PostSummary[]; canPublish?: boolean }) {
  const withActions: Column<PostSummary>[] = canPublish
    ? [
        ...columns,
        {
          key: "actions",
          header: "Actions",
          render: (p) => (
            <PublicationActions
              postId={p.id}
              postStatus={p.status}
              platform={p.platform}
              approvalStatus={p.approvalStatus}
              publication={p.publication}
              canReview={false}
              canPublish
            />
          ),
        },
      ]
    : columns;
  return <DataTable columns={withActions} rows={posts} rowKey={(p) => p.id} caption="Social posts" />;
}
