import Link from "next/link";

import { AdminHeader } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { AREA_LABELS, goLiveChecklist, goLivePercent, type GoLiveItem, type GoLiveStatus } from "@/lib/admin/go-live";
import { getGoLiveFacts } from "@/lib/admin/go-live-facts";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

// Owner's request (Nov 2026): "everything needs to be at 100%". This screen
// measures it live: each item is read from the server settings and from
// production evidence, and the percentage climbs as items are closed.

const STATUS: Record<GoLiveStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  done: { label: "Fait · Done", tone: "success" },
  partial: { label: "En partie · Partly", tone: "warning" },
  todo: { label: "À faire · To do", tone: "danger" },
  manual: { label: "À vérifier · Check by hand", tone: "neutral" },
};

const AREAS: GoLiveItem["area"][] = ["sales", "automation", "ai", "communication", "providers", "accounts"];

export default async function GoLivePage() {
  await requireAdminAccess();
  const facts = await getGoLiveFacts();
  const items = goLiveChecklist(process.env, facts);
  const percent = goLivePercent(items);
  const done = items.filter((item) => item.status === "done").length;
  const counted = items.filter((item) => item.status !== "manual").length;
  const ownerTodo = items.filter((item) => item.who === "owner" && (item.status === "todo" || item.status === "partial")).length;
  const teamTodo = items.filter((item) => item.who === "team" && (item.status === "todo" || item.status === "partial")).length;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Mise en service · Go-live"
        subtitle="Everything TAKATAK needs to run at 100% in production, measured live from the server settings and production data. Each item says what is true now and exactly what closes it."
        badges={["Platform owners and admins"]}
        actions={
          <Link href="/dashboard/admin/ai" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-blue-300">
            AI Control Center →
          </Link>
        }
      />

      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ready for production</p>
              <p className="text-4xl font-bold tracking-tight text-slate-900">{percent} %</p>
            </div>
            <p className="text-sm text-slate-600">
              {done} of {counted} items done · {ownerTodo} for you · {teamTodo} for the TAKATAK team
            </p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Ready for production">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-slate-500">
            Server settings change in Coolify (application takatak.ca → Environment variables), then redeploy. Values are never shown here.
          </p>
        </CardBody>
      </Card>

      {AREAS.map((area) => {
        const group = items.filter((item) => item.area === area);
        if (!group.length) return null;
        return (
          <section key={area} className="space-y-3" aria-label={AREA_LABELS[area]}>
            <h2 className="text-sm font-semibold text-slate-900">{AREA_LABELS[area]}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {group.map((item) => {
                const status = STATUS[item.status];
                return (
                  <Card key={item.id}>
                    <CardBody className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <p className="text-sm text-slate-700">{item.now}</p>
                      {item.status !== "done" ? (
                        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
                          <span className="font-semibold">{item.who === "team" ? "TAKATAK team: " : "To do: "}</span>
                          {item.howTo}
                        </p>
                      ) : null}
                      {item.settings.length ? (
                        <p className="text-[11px] text-slate-500">
                          Settings: <span className="font-mono">{item.settings.join(" · ")}</span>
                        </p>
                      ) : null}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
