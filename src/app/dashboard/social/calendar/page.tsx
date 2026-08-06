import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SocialEmptyState } from "@/components/social/social-empty-state";
import { SocialHeader } from "@/components/social/social-header";
import { SourceBanner } from "@/components/social/source-banner";
import { PLATFORM_LABELS, POST_STATUS_LABELS, socialToneForStatus } from "@/lib/social/status";
import { getSocialCalendarData } from "@/lib/social/social-data";

export const dynamic = "force-dynamic";

export default async function SocialCalendarPage() {
  const data = await getSocialCalendarData();
  const scheduled = data.items.filter((i) => i.date);
  const unscheduled = data.items.filter((i) => !i.date);
  return (
    <div className="space-y-5">
      <SocialHeader
        title="Content Calendar"
        subtitle="Foundation calendar grouped by date. Drag-and-drop and real scheduling activate with Metricool (Phase 6)."
        badges={[{ label: "Foundation" }]}
      />
      <SourceBanner source={data.source} label={data.sourceLabel} />
      <Card>
        <CardHeader title="Scheduled" subtitle="Posts with a scheduled date. Scheduling does not publish anything yet." />
        <CardBody>
          {scheduled.length ? (
            <ul className="space-y-2">
              {scheduled.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-xs font-medium text-slate-500">{i.date}</span>
                  <span className="flex-1 truncate text-sm text-slate-800">{i.captionPreview}</span>
                  <span className="text-xs text-slate-400">{PLATFORM_LABELS[i.platform] ?? i.platform}</span>
                  <Badge tone={socialToneForStatus(i.status)}>{POST_STATUS_LABELS[i.status] ?? i.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <SocialEmptyState icon={CalendarDays} title="Nothing scheduled" description="Approved posts get scheduled once Metricool is connected in Phase 6." />
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Unscheduled" subtitle="Drafts and approvals without a date." />
        <CardBody>
          {unscheduled.length ? (
            <ul className="space-y-2">
              {unscheduled.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="flex-1 truncate text-sm text-slate-800">{i.captionPreview}</span>
                  <span className="text-xs text-slate-400">{i.campaignName ?? "—"}</span>
                  <span className="text-xs text-slate-400">{PLATFORM_LABELS[i.platform] ?? i.platform}</span>
                  <Badge tone={socialToneForStatus(i.status)}>{POST_STATUS_LABELS[i.status] ?? i.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <SocialEmptyState title="No unscheduled posts" description="Post drafts will appear here." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
