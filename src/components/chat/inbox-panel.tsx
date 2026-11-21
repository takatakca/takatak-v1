import Link from "next/link";

import { toggleChatWidgetAction } from "@/app/dashboard/growth/conversations/actions";
import { CopySnippet } from "@/components/growth/copy-snippet";
import { GrowthKpi } from "@/components/growth/growth-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { InboxSnapshot } from "@/lib/chat/service";

import { CreateWidgetForm } from "./create-widget-form";

export function InboxPanel({
  data,
  canManage,
  origin,
  status,
}: {
  data: InboxSnapshot;
  canManage: boolean;
  origin: string;
  status: "open" | "closed";
}) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-3">
        <GrowthKpi label="Conversations ouvertes · Open" value={String(data.totals.open)} />
        <GrowthKpi label="Messages non lus · Unread" value={String(data.totals.unread)} />
        <GrowthKpi label="Nouvelles aujourd’hui · New today" value={String(data.totals.today)} />
      </section>

      <Card>
        <CardHeader
          title="Boîte de réception · Inbox"
          subtitle="Conversations du clavardage du site ; vos réponses s’affichent chez le visiteur en quelques secondes · Replies appear in the visitor's chat bubble within seconds."
          action={
            <div className="flex gap-2 text-xs font-medium">
              <Link href="?status=open" className={status === "open" ? "text-indigo-700" : "text-slate-500 hover:text-slate-800"}>
                Ouvertes · Open
              </Link>
              <Link href="?status=closed" className={status === "closed" ? "text-indigo-700" : "text-slate-500 hover:text-slate-800"}>
                Fermées · Closed
              </Link>
            </div>
          }
        />
        <CardBody className="p-0">
          {data.conversations.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              {data.widgets.length === 0
                ? "Créez un clavardage ci-dessous et installez-le sur le site pour recevoir des messages · Create a chat below and install it on the website."
                : status === "open"
                  ? "Aucune conversation ouverte · No open conversations."
                  : "Aucune conversation fermée · No closed conversations."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`/dashboard/growth/conversations/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {c.visitorName ?? "Visiteur du site · Website visitor"}{" "}
                        <span className="text-xs font-normal text-slate-400">· {c.widgetName}</span>
                      </p>
                      <p className="truncate text-xs text-slate-600">{c.preview ?? "—"}</p>
                    </div>
                    {c.leadId ? <Badge tone="success">Prospect · Lead</Badge> : null}
                    {c.unread > 0 ? <Badge tone="danger">{c.unread} nouveau{c.unread > 1 ? "x" : ""} · new</Badge> : null}
                    <span className="text-xs text-slate-400">{c.lastMessageAt.toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Clavardages du site · Chat widgets"
          subtitle="Un par site ; la bulle ne fonctionne que sur le domaine pour lequel elle a été créée · One per website, locked to its domain."
        />
        <CardBody className="space-y-4">
          {data.widgets.map((w) => (
            <div key={w.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{w.name}</p>
                <span className="text-xs text-slate-500">{w.domains.join(", ")}</span>
                <Badge tone={w.active ? "success" : "muted"}>{w.active ? "En ligne · Live" : "En pause · Paused"}</Badge>
                <span className="text-xs text-slate-400">{w.open} ouverte{w.open > 1 ? "s" : ""} · open</span>
                {canManage ? (
                  <form action={toggleChatWidgetAction} className="ml-auto">
                    <input type="hidden" name="widgetId" value={w.id} />
                    <input type="hidden" name="active" value={w.active ? "false" : "true"} />
                    <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">{w.active ? "Mettre en pause · Pause" : "Reprendre · Resume"}</button>
                  </form>
                ) : null}
              </div>
              <CopySnippet code={`<script defer src="${origin}/takatak-chat.js" data-widget="${w.publicKey}"></script>`} />
            </div>
          ))}
          {canManage ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Nouveau clavardage · New chat widget</p>
              <CreateWidgetForm brands={data.brands} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
