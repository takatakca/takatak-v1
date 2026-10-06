import {
  connectGoogleBusinessAction,
  disconnectGoogleBusinessAction,
  syncGoogleReviewsAction,
  toggleGoogleLocationSyncAction,
} from "@/app/dashboard/growth/reviews/actions";
import { GrowthKpi } from "@/components/growth/growth-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { GoogleBusinessSnapshot } from "@/lib/integrations/google-business/service";

import { GoogleReplyForm } from "./google-reply-form";

const NOTICE: Record<string, string> = {
  connected: "Google Business Profile connected. Run a sync to import reviews.",
  synced: "Google reviews are up to date.",
  denied: "Google access was not granted.",
  not_configured: "Google Business Profile is not configured on this server yet.",
  invalid_state: "That Google sign-in link was not started from this account. Please try again.",
  expired_state: "That Google sign-in link expired. Please try again.",
  scope_not_granted: "Google did not grant review management access.",
  no_refresh_token: "Google did not return offline access. Please reconnect.",
  access_revoked: "Google access was revoked. Please reconnect.",
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-slate-200">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function GoogleBusinessPanel({ data, canManage, notice }: { data: GoogleBusinessSnapshot; canManage: boolean; notice: string | null }) {
  const connected = data.connection && data.connection.status !== "revoked";
  return (
    <Card>
      <CardHeader
        title="Google reviews"
        subtitle="Import every Google review automatically and answer it from TAKATAK (Google Business Profile)."
        action={
          connected ? (
            <Badge tone={data.connection!.status === "active" ? "success" : "danger"}>{data.connection!.status === "active" ? "Connected" : "Needs attention"}</Badge>
          ) : (
            <Badge tone={data.configured ? "warning" : "muted"}>{data.configured ? "Not connected" : "Not configured"}</Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        {notice ? (
          <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {NOTICE[notice] ?? `Google: ${notice.replace(/_/g, " ")}`}
          </p>
        ) : null}

        {!connected ? (
          canManage && data.configured ? (
            <form action={connectGoogleBusinessAction}>
              <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Connect Google Business Profile</button>
            </form>
          ) : (
            <p className="text-sm text-slate-500">
              {data.configured
                ? "Ask a workspace manager to connect the Google Business Profile."
                : "Needs Google Business Profile API access (Google approval), OAuth client credentials and GROWTH_TOKEN_ENCRYPTION_KEY_V1 on the server."}
            </p>
          )
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <GrowthKpi label="Google reviews" value={String(data.stats.total)} />
              <GrowthKpi label="Google rating" value={data.stats.averageRating !== null ? `${data.stats.averageRating.toFixed(1)} ★` : "—"} />
              <GrowthKpi label="Unanswered" value={String(data.stats.unanswered)} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Last sync: {data.connection!.lastSyncAt ? data.connection!.lastSyncAt.toLocaleString("en-CA") : "never"}</span>
              {data.connection!.lastError ? <span className="text-rose-700">· {data.connection!.lastError}</span> : null}
              {canManage ? (
                <>
                  <form action={syncGoogleReviewsAction} className="ml-auto">
                    <button className="rounded-lg border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:border-indigo-300">Sync now</button>
                  </form>
                  <form action={disconnectGoogleBusinessAction}>
                    <button className="text-slate-400 hover:text-rose-600">Disconnect</button>
                  </form>
                </>
              ) : null}
            </div>
            {data.locations.length ? (
              <ul className="space-y-1 text-xs">
                {data.locations.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-1.5">
                    <span className="font-medium text-slate-800">{l.title}</span>
                    {l.address ? <span className="text-slate-400">{l.address}</span> : null}
                    <span className="text-slate-500">· {l.reviewCount} reviews</span>
                    {canManage ? (
                      <form action={toggleGoogleLocationSyncAction} className="ml-auto">
                        <input type="hidden" name="locationId" value={l.id} />
                        <input type="hidden" name="enabled" value={l.syncEnabled ? "false" : "true"} />
                        <button className="text-slate-500 hover:text-slate-800">{l.syncEnabled ? "Syncing ✓" : "Sync off"}</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No locations found on this Google account yet.</p>
            )}
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {data.reviews.length === 0 ? <li className="px-4 py-4 text-sm text-slate-500">No Google reviews imported yet.</li> : null}
              {data.reviews.map((r) => (
                <li key={r.id} className="space-y-1.5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Stars rating={r.rating} />
                    <span className="font-medium text-slate-800">{r.reviewerName ?? "Google user"}</span>
                    <span className="text-slate-400">· {r.locationTitle}</span>
                    {r.replyComment ? <Badge tone="success">Answered</Badge> : <Badge tone="warning">Unanswered</Badge>}
                    <span className="ml-auto text-slate-400">{r.createdAt.toLocaleDateString("en-CA")}</span>
                  </div>
                  {r.comment ? <p className="whitespace-pre-wrap text-sm text-slate-700">{r.comment}</p> : null}
                  {r.replyComment ? (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold">Your reply: </span>
                      {r.replyComment}
                    </p>
                  ) : canManage ? (
                    <>
                      {r.aiDraft ? <p className="text-[11px] text-violet-700">AI draft ({r.aiDraft.status.replace("_", " ")}) pre-filled below — edit before publishing.</p> : null}
                      <GoogleReplyForm reviewId={r.id} draft={r.aiDraft?.text ?? null} />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}
