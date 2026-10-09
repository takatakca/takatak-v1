import { cancelAgentRunAction, decideAgentRunAction, saveAgentSettingAction } from "@/app/dashboard/growth/ai-engine/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { AgentSettingView, RunView } from "@/lib/ai-agents/service";

import { RunRequestForm } from "./run-request-form";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function scheduleLabel(s: AgentSettingView): string | null {
  if (s.schedule === "off") return null;
  const hour = `${String(s.scheduleHour).padStart(2, "0")}:00`;
  return s.schedule === "daily" ? `Every day at ${hour}` : `Every ${DAYS[s.scheduleWeekday ?? 1]} at ${hour}`;
}

const STATUS_LABEL: Record<RunView["status"], { label: string; tone: "neutral" | "accent" | "warning" | "success" | "danger" | "muted" }> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Working…", tone: "accent" },
  awaiting_approval: { label: "Needs approval", tone: "warning" },
  approved: { label: "Approved — publishing", tone: "accent" },
  executing: { label: "Publishing…", tone: "accent" },
  completed: { label: "Done", tone: "success" },
  rejected: { label: "Rejected", tone: "muted" },
  failed: { label: "Failed", tone: "danger" },
  canceled: { label: "Canceled", tone: "muted" },
};

export function AgentsPanel({
  settings,
  runs,
  canConfigure,
  canRun,
  canApprove,
  gatewayConfigured,
}: {
  settings: AgentSettingView[];
  runs: RunView[];
  canConfigure: boolean;
  canRun: boolean;
  canApprove: boolean;
  gatewayConfigured: boolean;
}) {
  const awaiting = runs.filter((r) => r.status === "awaiting_approval");
  return (
    <div className="space-y-6">
      {awaiting.length > 0 ? (
        <Card>
          <CardHeader title={`Waiting for your approval (${awaiting.length})`} subtitle="Nothing is published or spent until you approve it." />
          <CardBody className="space-y-3">
            {awaiting.map((r) => (
              <div key={r.id} className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {r.agentName} <span className="text-xs font-normal text-slate-500">· {r.createdAt.toLocaleString("en-CA")}</span>
                </p>
                {r.summary ? <p className="text-sm text-slate-700">{r.summary}</p> : null}
                {r.preview ? <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 font-sans text-xs text-slate-800 ring-1 ring-slate-200">{r.preview}</pre> : null}
                {canApprove ? (
                  <div className="flex gap-2">
                    <form action={decideAgentRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
                    </form>
                    <form action={decideAgentRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-rose-300">Reject</button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Your AI agents"
          subtitle={gatewayConfigured ? "Turn on the agents you want. The AI Gateway picks up queued runs." : "You can set agents up now; runs start once the AI Gateway is connected."}
        />
        <CardBody className="grid gap-3 lg:grid-cols-2">
          {settings.map((s) => (
            <div key={s.key} className="space-y-3 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <div className="flex items-center gap-1.5">
                  {s.enabled && scheduleLabel(s) ? <Badge tone="accent">{scheduleLabel(s)}</Badge> : null}
                  <Badge tone={s.enabled ? "success" : "muted"}>{s.enabled ? "On" : "Off"}</Badge>
                </div>
              </div>
              <p className="text-xs leading-5 text-slate-600">{s.mission}</p>
              {canConfigure ? (
                <form action={saveAgentSettingAction} className="space-y-2 rounded-lg bg-slate-50 p-2">
                  <input type="hidden" name="agentKey" value={s.key} />
                  <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" name="enabled" defaultChecked={s.enabled} /> Enabled
                    </label>
                    <label className="flex items-center gap-1.5" title={s.approvalLocked ? "This agent can spend money, so approval is always required." : undefined}>
                      <input type="checkbox" name="requireApproval" defaultChecked={s.requireApproval} disabled={s.approvalLocked} />
                      Ask me before publishing{s.approvalLocked ? " (always)" : ""}
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                    <span>Autopilot:</span>
                    <select name="schedule" defaultValue={s.schedule} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
                      <option value="off">Manual only</option>
                      <option value="daily">Every day</option>
                      <option value="weekly">Every week</option>
                    </select>
                    <select name="scheduleWeekday" defaultValue={String(s.scheduleWeekday ?? 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" aria-label="Day (weekly)">
                      {DAYS.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select name="scheduleHour" defaultValue={String(s.scheduleHour)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" aria-label="Hour">
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    name="instructions"
                    rows={2}
                    maxLength={2000}
                    defaultValue={s.instructions ?? ""}
                    placeholder="Standing instructions (tone, offers, things to avoid)…"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
                  />
                  <button className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300">Save</button>
                </form>
              ) : null}
              {canRun ? <RunRequestForm agentKey={s.key} disabled={!s.enabled} /> : null}
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recent agent runs" />
        <CardBody className="p-0">
          {runs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No runs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <span className="font-semibold text-slate-900">{r.agentName}</span>
                  <Badge tone={STATUS_LABEL[r.status].tone}>{STATUS_LABEL[r.status].label}</Badge>
                  {r.summary ? <span className="max-w-md truncate text-slate-600">{r.summary}</span> : r.brief ? <span className="max-w-md truncate text-slate-400">“{r.brief}”</span> : null}
                  {r.error ? <span className="text-rose-700">{r.error}</span> : null}
                  {r.creditsDebited ? <span className="text-slate-500">{r.creditsDebited} credits</span> : null}
                  <span className="ml-auto text-slate-400">{r.createdAt.toLocaleString("en-CA")}</span>
                  {canRun && (r.status === "queued" || r.status === "approved") ? (
                    <form action={cancelAgentRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <button className="text-slate-400 hover:text-rose-600">Cancel</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
