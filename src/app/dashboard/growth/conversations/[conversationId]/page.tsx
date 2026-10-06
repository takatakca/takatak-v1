import Link from "next/link";
import { notFound } from "next/navigation";

import { convertToLeadAction, setConversationStatusAction } from "@/app/dashboard/growth/conversations/actions";
import { ReplyForm } from "@/components/chat/reply-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getConversationThread } from "@/lib/chat/service";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

const SENDER_STYLE = {
  visitor: "self-start border border-slate-200 bg-white text-slate-900",
  staff: "self-end bg-indigo-600 text-white",
  ai: "self-end bg-violet-600 text-white",
  system: "self-center bg-slate-100 text-slate-500 text-xs",
} as const;

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) notFound();
  const access = await requireWorkspacePermission("view_conversations", `/dashboard/growth/conversations/${conversationId}`);
  const thread = await getConversationThread(access.activeClientId, conversationId);
  if (!thread) notFound();
  const canManage = hasEffectivePermission(access, "manage_conversations");

  return (
    <div className="space-y-5">
      <Link href="/dashboard/growth/conversations" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
        ← Inbox
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-950">{thread.visitorName ?? "Website visitor"}</h1>
          <p className="text-xs text-slate-500">
            {thread.widgetName} · started {thread.createdAt.toLocaleString("en-CA")}
            {thread.pageUrl ? ` · from ${thread.pageUrl}` : ""}
          </p>
          <p className="text-xs text-slate-600">{[thread.visitorEmail, thread.visitorPhone].filter(Boolean).join(" · ") || "No contact details shared"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={thread.status === "open" ? "success" : "muted"}>{thread.status}</Badge>
          {canManage ? (
            <>
              {thread.leadId ? (
                <Link href="/dashboard/leads" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
                  In Leads pipeline →
                </Link>
              ) : (
                <form action={convertToLeadAction}>
                  <input type="hidden" name="conversationId" value={thread.id} />
                  <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300">Convert to lead</button>
                </form>
              )}
              <form action={setConversationStatusAction}>
                <input type="hidden" name="conversationId" value={thread.id} />
                <input type="hidden" name="status" value={thread.status === "open" ? "closed" : "open"} />
                <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300">
                  {thread.status === "open" ? "Close" : "Reopen"}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader title="Conversation" />
        <CardBody className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto bg-slate-50">
          {thread.messages.map((m) => (
            <div key={m.id} className={`max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${SENDER_STYLE[m.sender]}`}>
              {m.body}
              <div className="mt-1 text-[10px] opacity-60">{m.createdAt.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          ))}
        </CardBody>
      </Card>

      {canManage ? <ReplyForm conversationId={thread.id} disabled={thread.status !== "open"} /> : null}
    </div>
  );
}
