import { GrowthKpi } from "@/components/growth/growth-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { convertReviewToLeadAction, toggleReviewProfileAction, updateFeedbackStatusAction } from "@/app/dashboard/growth/reviews/actions";
import type { ReputationSnapshot } from "@/lib/reputation/service";

import { CreateProfileForm } from "./create-profile-form";
import { RequestLinkForm } from "./request-link-form";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-slate-200">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

const STATUS_TONE = { new: "warning", acknowledged: "accent", resolved: "success" } as const;

export function ReputationWorkspace({
  data,
  canManage,
  smsReady = false,
  whatsappReady = false,
}: {
  data: ReputationSnapshot;
  canManage: boolean;
  smsReady?: boolean;
  whatsappReady?: boolean;
}) {
  const { stats } = data;
  const openRate = stats.requests ? Math.round((stats.opened / stats.requests) * 100) : null;
  const activeProfiles = data.profiles.filter((p) => p.active);
  const maxBar = Math.max(1, ...Object.values(stats.distribution));

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <GrowthKpi label="Average rating" value={stats.averageRating !== null ? `${stats.averageRating.toFixed(1)} ★` : "—"} hint={`${stats.responses} ratings`} />
        <GrowthKpi label="Requests sent" value={String(stats.requests)} />
        <GrowthKpi label="Opened" value={openRate !== null ? `${openRate}%` : "—"} hint={`${stats.opened} of ${stats.requests}`} />
        <GrowthKpi label="Rated via request" value={String(stats.rated)} />
        <GrowthKpi label="Went to Google/Facebook" value={String(stats.publicClicks)} />
        <GrowthKpi label="Open low ratings" value={String(stats.openFeedback)} hint="1–3★ not resolved" />
      </section>

      {stats.responses > 0 ? (
        <Card>
          <CardHeader title="Rating breakdown" />
          <CardBody className="space-y-1.5">
            {([5, 4, 3, 2, 1] as const).map((n) => (
              <div key={n} className="flex items-center gap-3 text-xs">
                <span className="w-8 text-slate-600">{n} ★</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-amber-400" style={{ width: `${(stats.distribution[n] / maxBar) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-slate-500">{stats.distribution[n]}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {canManage && activeProfiles.length > 0 ? (
        <Card>
          <CardHeader title="Send a review request" subtitle="Creates a one-time tracked link, then send it from your own phone or email." />
          <CardBody>
            <RequestLinkForm profiles={activeProfiles.map((p) => ({ id: p.id, name: p.name }))} smsReady={smsReady} whatsappReady={whatsappReady} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Feedback inbox" subtitle="Every rating customers leave, newest first. Low ratings stay open until resolved." />
        <CardBody className="p-0">
          {data.responses.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No ratings yet. Send a request link or share a review page to start collecting.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.responses.map((r) => (
                <li key={r.id} className="space-y-1.5 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Stars rating={r.rating} />
                    <span className="font-medium text-slate-800">{r.profileName}</span>
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    {r.publicLinkClicked ? <Badge tone="success">Went to public review</Badge> : null}
                    {r.viaRequest ? <Badge tone="neutral">Via request</Badge> : <Badge tone="muted">Shared link</Badge>}
                    {r.leadId ? <Badge tone="success">Lead created</Badge> : null}
                    <span className="ml-auto text-slate-400">{r.createdAt.toLocaleString("en-CA")}</span>
                  </div>
                  {r.feedback ? <p className="whitespace-pre-wrap text-sm text-slate-700">{r.feedback}</p> : null}
                  {r.followUpConsent ? (
                    <p className="text-xs text-slate-500">
                      Wants a follow-up: {[r.contactName, r.contactEmail, r.contactPhone].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {canManage && r.followUpConsent && !r.leadId ? (
                    <form action={convertReviewToLeadAction}>
                      <input type="hidden" name="responseId" value={r.id} />
                      <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:border-emerald-400">
                        Create lead for follow-up
                      </button>
                    </form>
                  ) : null}
                  {canManage && r.status !== "resolved" ? (
                    <div className="flex gap-2">
                      {r.status === "new" ? (
                        <form action={updateFeedbackStatusAction}>
                          <input type="hidden" name="responseId" value={r.id} />
                          <input type="hidden" name="status" value="acknowledged" />
                          <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300">Acknowledge</button>
                        </form>
                      ) : null}
                      <form action={updateFeedbackStatusAction}>
                        <input type="hidden" name="responseId" value={r.id} />
                        <input type="hidden" name="status" value="resolved" />
                        <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-emerald-300">Mark resolved</button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Review pages" subtitle="Share the link or print it as a QR code at the counter. Anyone can rate; tracked requests add open and rating tracking." />
        <CardBody className="space-y-4">
          {data.profiles.length === 0 ? <p className="text-sm text-slate-500">No review page yet.</p> : null}
          {data.profiles.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {p.name} {p.brandName ? <span className="text-xs font-normal text-slate-400">· {p.brandName}</span> : null}
                </p>
                <p className="truncate font-mono text-xs text-slate-500">/r/{p.publicSlug}</p>
                <p className="text-[11px] text-slate-400">
                  {p.requestCount} requests · {p.responseCount} ratings · {[p.googlePlaceId ? "Google" : null, p.facebookReviewUrl ? "Facebook" : null].filter(Boolean).join(" + ")}
                </p>
              </div>
              <Badge tone={p.active ? "success" : "muted"}>{p.active ? "Active" : "Paused"}</Badge>
              <a href={`/r/${p.publicSlug}`} target="_blank" rel="noreferrer noopener" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                Open ↗
              </a>
              {canManage ? (
                <form action={toggleReviewProfileAction}>
                  <input type="hidden" name="profileId" value={p.id} />
                  <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                  <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">{p.active ? "Pause" : "Resume"}</button>
                </form>
              ) : null}
            </div>
          ))}
          {canManage ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">New review page</p>
              <CreateProfileForm brands={data.brands} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
