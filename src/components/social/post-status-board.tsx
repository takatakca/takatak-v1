import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { POST_STATUS_LABELS, POST_STATUS_TRANSITIONS, socialToneForStatus } from "@/lib/social/status";
import type { PostPipeline } from "@/lib/social/types";

const ORDER: (keyof PostPipeline)[] = ["draft", "pending_approval", "approved", "scheduled", "blocked_by_plan", "published", "failed"];

export function PostStatusBoard({ pipeline }: { pipeline: PostPipeline }) {
  return (
    <Card>
      <CardHeader
        title="Post Pipeline"
        subtitle="Status machine — scheduling and publishing activate with Metricool (Phase 6)."
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {ORDER.map((s) => (
            <div key={s} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
              <p className="text-lg font-semibold text-slate-900">{pipeline[s]}</p>
              <Badge tone={socialToneForStatus(s)}>{POST_STATUS_LABELS[s]}</Badge>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-100 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Allowed transitions</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {ORDER.filter((s) => POST_STATUS_TRANSITIONS[s].length).map((s) =>
              `${POST_STATUS_LABELS[s]} → ${POST_STATUS_TRANSITIONS[s].map((t) => POST_STATUS_LABELS[t]).join(" / ")}`
            ).join(" · ")}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
