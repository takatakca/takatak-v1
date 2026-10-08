// Staff updates to one lead: status, priority, follow-up date and notes.
// Every change is written as LeadActivity history plus an audit entry, in one
// transaction, and only inside the caller's workspace.

import type { LeadPriority, LeadStatus, Prisma } from "@prisma/client";

import { LEAD_PRIORITY_LABELS, LEAD_STATUS_LABELS } from "./status";

export const LEAD_STATUSES = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];
export const LEAD_PRIORITIES = Object.keys(LEAD_PRIORITY_LABELS) as LeadPriority[];
export const MAX_NOTE_LENGTH = 2000;

export interface LeadUpdate {
  status?: LeadStatus;
  priority?: LeadPriority;
  /** YYYY-MM-DD, or null to clear. */
  followUpOn?: string | null;
  note?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseLeadUpdate(body: unknown): LeadUpdate | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = body as Record<string, unknown>;
  const update: LeadUpdate = {};

  if (raw.status !== undefined) {
    if (!LEAD_STATUSES.includes(raw.status as LeadStatus)) return null;
    update.status = raw.status as LeadStatus;
  }
  if (raw.priority !== undefined) {
    if (!LEAD_PRIORITIES.includes(raw.priority as LeadPriority)) return null;
    update.priority = raw.priority as LeadPriority;
  }
  if (raw.followUpOn !== undefined) {
    if (raw.followUpOn === null || raw.followUpOn === "") update.followUpOn = null;
    else if (typeof raw.followUpOn === "string" && DATE_RE.test(raw.followUpOn) && !Number.isNaN(Date.parse(`${raw.followUpOn}T12:00:00Z`))) {
      update.followUpOn = raw.followUpOn;
    } else return null;
  }
  if (raw.note !== undefined) {
    if (typeof raw.note !== "string") return null;
    const note = raw.note.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (note.length > MAX_NOTE_LENGTH) return null;
    if (note) update.note = note;
  }

  return Object.keys(update).length ? update : null;
}

type Tx = Pick<Prisma.TransactionClient, "lead" | "leadActivity" | "auditLog">;
export interface LeadActionsDb {
  $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/** Noon UTC keeps the calendar day stable in every Canadian time zone. */
function followUpDate(day: string): Date {
  return new Date(`${day}T12:00:00.000Z`);
}

function sameDay(a: Date | null, b: Date | null): boolean {
  return (a?.toISOString().slice(0, 10) ?? null) === (b?.toISOString().slice(0, 10) ?? null);
}

export async function applyLeadUpdate(
  db: LeadActionsDb,
  input: { clientId: string; leadId: string; profileId: string | null; update: LeadUpdate; now?: Date },
): Promise<{ ok: true; changes: string[] } | { ok: false; reason: "not_found" }> {
  const now = input.now ?? new Date();
  const { update } = input;

  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({
      where: { id: input.leadId, clientId: input.clientId },
      select: { id: true, status: true, priority: true, followUpAt: true, businessBrandId: true },
    });
    if (!lead) return { ok: false as const, reason: "not_found" as const };

    const data: Prisma.LeadUpdateInput = {};
    const changes: string[] = [];
    const activity = (entry: Omit<Prisma.LeadActivityUncheckedCreateInput, "clientId" | "leadId" | "businessBrandId">) =>
      tx.leadActivity.create({
        data: {
          ...entry,
          clientId: input.clientId,
          leadId: lead.id,
          businessBrandId: lead.businessBrandId,
          metadata: { actorProfileId: input.profileId, source: "lead_detail" },
        },
      });

    if (update.status && update.status !== lead.status) {
      data.status = update.status;
      changes.push("status");
      await activity({
        type: "status_change",
        status: "completed_internal",
        title: `Status: ${LEAD_STATUS_LABELS[lead.status] ?? lead.status} → ${LEAD_STATUS_LABELS[update.status] ?? update.status}`,
        completedAt: now,
      });
    }
    if (update.priority && update.priority !== lead.priority) {
      data.priority = update.priority;
      changes.push("priority");
      await activity({
        type: "status_change",
        status: "completed_internal",
        title: `Priority: ${LEAD_PRIORITY_LABELS[lead.priority] ?? lead.priority} → ${LEAD_PRIORITY_LABELS[update.priority] ?? update.priority}`,
        completedAt: now,
      });
    }
    if (update.followUpOn !== undefined) {
      const next = update.followUpOn ? followUpDate(update.followUpOn) : null;
      if (!sameDay(lead.followUpAt, next)) {
        data.followUpAt = next;
        changes.push("followUp");
        await activity(
          next
            ? { type: "follow_up", status: "planned", title: `Follow up on ${update.followUpOn}`, dueAt: next }
            : { type: "follow_up", status: "cancelled", title: "Follow-up cleared", completedAt: now },
        );
      }
    }
    if (update.note) {
      changes.push("note");
      await activity({ type: "note", status: "completed_internal", title: "Note", note: update.note, completedAt: now });
    }

    if (Object.keys(data).length) {
      await tx.lead.update({ where: { id: lead.id }, data });
    }
    if (changes.length) {
      await tx.auditLog.create({
        data: {
          clientId: input.clientId,
          profileId: input.profileId,
          action: "lead_updated",
          entityType: "Lead",
          entityId: lead.id,
          metadata: { changes },
        },
      });
    }
    return { ok: true as const, changes };
  });
}
