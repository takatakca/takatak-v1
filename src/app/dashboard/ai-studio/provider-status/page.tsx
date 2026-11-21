import Link from "next/link";

import { AiHeader } from "@/components/ai-studio/ai-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { TAKBOT_ENGINES, type TakbotMode } from "@/lib/takbot/catalog";
import { connectedEngines } from "@/lib/takbot/server";
import { getServerAccessContext } from "@/lib/security/access-context";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<TakbotMode, string> = {
  chat: "Clavardage · Chat",
  write: "Rédaction · Writing",
  research: "Recherche · Research",
  image: "Images",
  voice: "Voix · Voice",
  video: "Vidéo · Video",
};

/** The AI engines behind AI Studio and TAK-TAK, as they are right now. Names and states only. */
export default async function ProviderStatusPage() {
  const [{ access }, connected] = await Promise.all([
    getServerAccessContext(),
    connectedEngines().catch(() => new Set<string>()),
  ]);
  const engines = [...TAKBOT_ENGINES].sort(
    (a, b) => Number(connected.has(b.key)) - Number(connected.has(a.key)) || a.name.localeCompare(b.name),
  );
  const live = engines.filter((engine) => connected.has(engine.key)).length;

  return (
    <div className="space-y-5">
      <AiHeader
        title="Moteurs IA · AI engines"
        subtitle={`${live} moteur${live > 1 ? "s" : ""} sur ${engines.length} branché${live > 1 ? "s" : ""} en ce moment. TAK-TAK choisit le meilleur moteur branché pour chaque tâche · ${live} of ${engines.length} engines connected right now. TAK-TAK picks the best connected engine for each task.`}
        actions={
          access.mode === "platform_admin" ? (
            <Link href="/dashboard/admin/ai" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Centre de contrôle IA · AI Control Center
            </Link>
          ) : null
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {engines.map((engine) => {
          const on = connected.has(engine.key);
          return (
            <Card key={engine.key}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{engine.name}</h3>
                  <Badge tone={on ? "success" : "neutral"}>{on ? "Branché · Connected" : "Pas branché · Not connected"}</Badge>
                </div>
                <p className="text-xs text-slate-500">{engine.bestFor}</p>
                <p className="text-[11px] text-slate-400">{engine.modes.map((mode) => MODE_LABELS[mode]).join(" · ")}</p>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
