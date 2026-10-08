"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";

import { LEAD_PRIORITY_LABELS, LEAD_STATUS_LABELS } from "@/lib/leads/status";

export function LeadActionsForm({
  leadId,
  status,
  priority,
  followUpOn,
}: {
  leadId: string;
  status: string;
  priority: string;
  followUpOn: string | null;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [nextPriority, setNextPriority] = useState(priority);
  const [nextFollowUp, setNextFollowUp] = useState(followUpOn ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const dirty =
    nextStatus !== status || nextPriority !== priority || nextFollowUp !== (followUpOn ?? "") || note.trim() !== "";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setMessage(null);
    const body: Record<string, unknown> = {};
    if (nextStatus !== status) body.status = nextStatus;
    if (nextPriority !== priority) body.priority = nextPriority;
    if (nextFollowUp !== (followUpOn ?? "")) body.followUpOn = nextFollowUp || null;
    if (note.trim()) body.note = note;
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setMessage({ tone: "error", text: result.message ?? "The lead could not be updated." });
      } else {
        setNote("");
        setMessage({ tone: "ok", text: "Saved." });
        router.refresh();
      }
    } catch {
      setMessage({ tone: "error", text: "The lead could not be updated. Check your connection." });
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Status
          <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className={field}>
            {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Priority
          <select value={nextPriority} onChange={(e) => setNextPriority(e.target.value)} className={field}>
            {Object.entries(LEAD_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Follow up on
          <input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} className={field} />
        </label>
      </div>
      <label className="block space-y-1 text-xs font-medium text-slate-600">
        Add a note
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Call summary, next step, quote sent…"
          className={field}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
        {message ? (
          <span role={message.tone === "error" ? "alert" : "status"} className={`text-xs ${message.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}>
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
