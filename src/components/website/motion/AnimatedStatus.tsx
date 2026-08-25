"use client";

import { useLanguage } from "@/lib/website/use-language";

export type StatusKey =
  | "checking"
  | "available"
  | "connecting"
  | "secured"
  | "building"
  | "live"
  | "campaignActive"
  | "newOpportunity"
  | "callRouted"
  | "workflowCompleted"
  | "awaitingApproval"
  | "approved";

const LABELS: Record<StatusKey, { en: string; fr: string }> = {
  checking: { en: "Checking", fr: "Vérification" },
  available: { en: "Available", fr: "Disponible" },
  connecting: { en: "Connecting", fr: "Connexion" },
  secured: { en: "Secured", fr: "Sécurisé" },
  building: { en: "Building", fr: "En construction" },
  live: { en: "Live", fr: "En ligne" },
  campaignActive: { en: "Campaign active", fr: "Campagne active" },
  newOpportunity: { en: "New opportunity", fr: "Nouvelle occasion" },
  callRouted: { en: "Call routed", fr: "Appel acheminé" },
  workflowCompleted: { en: "Workflow completed", fr: "Automatisation terminée" },
  awaitingApproval: { en: "Awaiting approval", fr: "En attente d'approbation" },
  approved: { en: "Approved", fr: "Approuvé" },
};

const TONES: Record<StatusKey, "neutral" | "progress" | "done"> = {
  checking: "progress",
  available: "done",
  connecting: "progress",
  secured: "done",
  building: "progress",
  live: "done",
  campaignActive: "done",
  newOpportunity: "done",
  callRouted: "done",
  workflowCompleted: "done",
  awaitingApproval: "neutral",
  approved: "done",
};

/**
 * Shared status pill used inside the demonstration scene. These are visual
 * explanations of the TAKATAK workflow, never live provider data.
 */
export function AnimatedStatus({ status, pulse = false }: { status: StatusKey; pulse?: boolean }) {
  const { tx } = useLanguage();
  const tone = TONES[status];
  const color =
    tone === "done"
      ? "text-primary border-primary/40 bg-primary/10"
      : tone === "progress"
        ? "text-foreground/80 border-white/20 bg-white/[0.06]"
        : "text-muted-foreground border-white/12 bg-white/[0.04]";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? "tk-blink" : ""}`} />
      {tx(LABELS[status])}
    </span>
  );
}
