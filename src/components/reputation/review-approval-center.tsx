"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Inbox,
  PencilLine,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { reviewSource } from "@/lib/reputation/sources";
import { canonicalReviewReply } from "@/lib/reputation/review-target-model";

export type ReviewApprovalRun = {
  id: string;
  reviewId: string | null;
  source: "google" | "qmaps" | "takatak";
  author: string;
  location: string;
  reviewText: string | null;
  rating: number | null;
  status: string;
  draft: string | null;
  draftHash: string | null;
  creditsDebited: number;
  createdAt: string;
  decidedAt?: string | null;
  error?: string | null;
  blockedReason?: string | null;
  /** Set from source evidence, never inferred from a completed worker run. */
  publishedAt?: string | null;
};
export type ReviewDraftDecisionState =
  { ok: null } | { ok: true; message: string } | { ok: false; error: string };
export type ReviewDraftEditState =
  | { ok: null }
  | { ok: false; error: string }
  | { ok: true; message: string; draft: string; draftHash: string };
type DecisionAction = (
  previous: ReviewDraftDecisionState,
  form: FormData,
) => Promise<ReviewDraftDecisionState>;
type EditAction = (
  previous: ReviewDraftEditState,
  form: FormData,
) => Promise<ReviewDraftEditState>;
type StatusGroup = "all" | "approval" | "processing" | "finished" | "failed";
type Decision = { kind: "approve" | "reject"; hash: string; message: string };
type EditorSession = {
  text: string;
  savedDraft: string;
  hash: string | null;
  propHash: string | null;
  originalBlockedReason: string | null;
  locallySaved: boolean;
  needsReload: boolean;
  message: string | null;
  error: string | null;
  decision: Decision | null;
  pending: boolean;
  revision: number;
};
type Sessions = Record<string, EditorSession>;

const PROCESSING = new Set(["queued", "running", "approved", "executing"]);
const FINISHED = new Set(["completed", "rejected", "canceled"]);
const STATUS: Record<
  string,
  {
    label: string;
    tone: "neutral" | "accent" | "warning" | "danger";
    detail: string;
  }
> = {
  queued: {
    label: "En attente de génération",
    tone: "neutral",
    detail: "La demande attend le service de traitement configuré.",
  },
  running: {
    label: "Génération en cours",
    tone: "accent",
    detail: "Le service de traitement prépare le brouillon.",
  },
  awaiting_approval: {
    label: "À approuver",
    tone: "warning",
    detail: "Relisez et ajustez le texte avant de décider de son exécution.",
  },
  approved: {
    label: "Approuvé · exécution à venir",
    tone: "accent",
    detail:
      "La décision est enregistrée. La confirmation de la source reste à recevoir.",
  },
  executing: {
    label: "Exécution en cours",
    tone: "accent",
    detail:
      "Le résultat de la source n’est pas encore confirmé dans cette vue.",
  },
  completed: {
    label: "Traitement terminé",
    tone: "neutral",
    detail: "La publication doit être confirmée par la source concernée.",
  },
  rejected: {
    label: "Refusé",
    tone: "neutral",
    detail: "Ce traitement a été refusé.",
  },
  canceled: {
    label: "Annulé",
    tone: "neutral",
    detail: "Ce traitement a été annulé.",
  },
  failed: {
    label: "Échec du traitement",
    tone: "danger",
    detail:
      "Vérifiez le résultat auprès de la source avant de relancer un envoi interrompu.",
  },
};
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#1565D8] px-4 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

function newSession(run: ReviewApprovalRun): EditorSession {
  return {
    text: run.draft || "",
    savedDraft: run.draft || "",
    hash: run.draftHash,
    propHash: run.draftHash,
    originalBlockedReason: run.blockedReason || null,
    locallySaved: false,
    needsReload: false,
    message: null,
    error: null,
    decision: null,
    pending: false,
    revision: 0,
  };
}
function effectiveStatus(run: ReviewApprovalRun, session?: EditorSession) {
  const decision = session?.decision;
  if (
    run.status === "awaiting_approval" &&
    decision &&
    decision.hash === session?.hash &&
    (run.draftHash === session.hash || run.draftHash === session.propHash)
  ) {
    return decision.kind === "reject"
      ? "rejected"
      : run.source === "takatak"
        ? "completed"
        : "approved";
  }
  return run.status;
}
function sourceConfirmed(run: ReviewApprovalRun) {
  return !!run.publishedAt && Number.isFinite(Date.parse(run.publishedAt));
}
function Timestamp({ value }: { value: string }) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? (
    <time dateTime={date.toISOString()}>
      {date.toISOString().slice(0, 16).replace("T", " ")} UTC
    </time>
  ) : (
    <span>Horodatage indisponible</span>
  );
}

function ReviewEditor({
  run,
  session,
  canDecide,
  isRefreshing,
  decisionAction,
  editAction,
  onChange,
  onReload,
  onSaved,
  onDecision,
  onFailure,
  onPending,
}: {
  run: ReviewApprovalRun;
  session: EditorSession;
  canDecide: boolean;
  isRefreshing: boolean;
  decisionAction: DecisionAction;
  editAction: EditAction;
  onChange: (text: string) => void;
  onReload: () => void;
  onSaved: (
    result: Extract<ReviewDraftEditState, { ok: true }>,
    submittedText: string,
  ) => void;
  onDecision: (
    kind: "approve" | "reject",
    hash: string,
    message: string,
  ) => void;
  onFailure: (error: string) => void;
  onPending: (pending: boolean) => void;
}) {
  const statusKey = effectiveStatus(run, session);
  const status = STATUS[statusKey] ?? {
    label: "État à vérifier",
    tone: "neutral" as const,
    detail: "Actualisez les traitements pour vérifier leur état.",
  };
  const dirty = session.text !== session.savedDraft;
  const remoteChanged =
    run.draftHash !== session.propHash && run.draftHash !== session.hash;
  const stale = session.needsReload || remoteChanged;
  const editable =
    canDecide && statusKey === "awaiting_approval" && !!session.hash;
  const maxLength = run.source === "qmaps" ? 2000 : 4000;
  const canonical = canonicalReviewReply(run.source, session.text);
  const blockedReason =
    session.locallySaved &&
    run.draftHash === session.propHash &&
    (run.blockedReason || null) === session.originalBlockedReason
      ? null
      : run.blockedReason;
  const approvalBlocked =
    !editable ||
    dirty ||
    stale ||
    !canonical ||
    !session.savedDraft ||
    !!blockedReason;
  const [actionState, action, actionPending] = useActionState(
    async (
      _previous: ReviewDraftDecisionState,
      form: FormData,
    ): Promise<ReviewDraftDecisionState> => {
      const intent = form.get("intent");
      try {
        if (!editable || stale)
          return {
            ok: false,
            error: "Chargez la version actuelle avant de décider.",
          };
        if (intent === "save") {
          if (!canonical)
            return {
              ok: false,
              error: "Saisissez un texte valide avant de l’enregistrer.",
            };
          const result = await editAction({ ok: null }, form);
          if (result.ok === true) {
            onSaved(result, String(form.get("replyText") || ""));
            return { ok: true, message: result.message };
          }
          if (result.ok === false) onFailure(result.error);
          return result;
        }
        if (intent !== "approve" && intent !== "reject")
          return {
            ok: false,
            error: "Choisissez une action pour ce brouillon.",
          };
        if (intent === "approve" && approvalBlocked)
          return {
            ok: false,
            error: "Enregistrez et relisez le texte avant de l’approuver.",
          };
        form.set("decision", intent);
        const result = await decisionAction({ ok: null }, form);
        if (result.ok === true)
          onDecision(intent, session.hash!, result.message);
        else if (result.ok === false) onFailure(result.error);
        return result;
      } catch {
        const error =
          "Le résultat n’a pas pu être confirmé. Votre texte local est conservé; actualisez avant de réessayer.";
        onFailure(error);
        return { ok: false, error };
      } finally {
        onPending(false);
      }
    },
    { ok: null },
  );
  const pending = actionPending || session.pending;
  const confirmed = sourceConfirmed(run);
  const feedback = session.decision?.message || session.message;
  const error =
    session.error || (actionState.ok === false ? actionState.error : null);
  return (
    <article
      aria-label="Réponse sélectionnée"
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1565D8]">
              Réponse sélectionnée
            </p>
            <h3 className="mt-2 break-words text-lg font-semibold text-slate-900">
              {run.author}
            </h3>
            <p className="mt-1 break-words text-xs leading-6 text-slate-600">
              {reviewSource(run.source)?.name || run.source} · {run.location}
              {run.rating !== null ? " · " + run.rating + "/5" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {confirmed && <Badge tone="success">Source confirmée</Badge>}
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          Demande du <Timestamp value={run.createdAt} />
        </p>
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            L’avis d’origine
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
            {run.reviewText ||
              "Le contenu de cet avis n’est plus disponible dans cet espace."}
          </p>
        </div>

        <form
          action={action}
          onSubmit={() => onPending(true)}
          aria-busy={pending}
          className="space-y-4"
        >
          <input type="hidden" name="runId" value={run.id} />
          <input
            type="hidden"
            name="expectedDraftHash"
            value={session.hash || ""}
          />
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={"review-draft-" + run.id}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"
              >
                <PencilLine aria-hidden className="h-4 w-4 text-[#1565D8]" />
                {!editable && (dirty || stale)
                  ? "Votre texte local"
                  : editable
                    ? "Votre réponse"
                    : "Texte du traitement"}
              </label>
              {dirty ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900">
                  Modifications non enregistrées
                </span>
              ) : session.savedDraft ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <Check aria-hidden className="h-3 w-3" /> Texte enregistré
                </span>
              ) : null}
            </div>
            <textarea
              id={"review-draft-" + run.id}
              name="replyText"
              value={session.text}
              onChange={(event) => onChange(event.target.value)}
              readOnly={!editable}
              disabled={pending}
              rows={8}
              aria-describedby={"review-draft-help-" + run.id}
              placeholder={
                editable
                  ? "Ajustez la réponse avant de l’enregistrer…"
                  : "Aucun texte de réponse valide n’est enregistré."
              }
              className="mt-3 block min-h-48 w-full resize-y rounded-xl border border-blue-200 bg-blue-50/40 p-4 text-sm leading-7 text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-70"
            />
            <div
              id={"review-draft-help-" + run.id}
              className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] leading-5 text-slate-600"
            >
              <p>
                {editable
                  ? "La modification manuelle ne génère pas de nouveau débit de crédits."
                  : "Ce texte est conservé pour le suivi du traitement."}
              </p>
              <p
                className={
                  session.text.length > maxLength
                    ? "font-semibold text-rose-700"
                    : "tabular-nums"
                }
              >
                {session.text.length.toLocaleString("fr-CA")} /{" "}
                {maxLength.toLocaleString("fr-CA")} caractères
              </p>
            </div>
            {editable && !canonical && (
              <p className="mt-2 text-xs leading-5 text-rose-700">
                Saisissez une réponse valide de 1 à{" "}
                {maxLength.toLocaleString("fr-CA")} caractères.
              </p>
            )}
          </div>

          {stale && (
            <div
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"
            >
              <p className="font-semibold">
                Vérifiez la version enregistrée avant de décider.
              </p>
              <p>
                Votre texte local est conservé. Actualisez la liste puis
                rechargez la version actuelle pour reprendre.
              </p>
            </div>
          )}
          {statusKey === "awaiting_approval" && blockedReason && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
              {blockedReason}
            </p>
          )}

          {editable && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="intent"
                  value="save"
                  disabled={pending || stale || !dirty || !canonical}
                  className={button}
                >
                  <Save aria-hidden className="h-4 w-4" />
                  {pending ? "Traitement…" : "Enregistrer le brouillon"}
                </button>
                {(dirty || stale) && (
                  <button
                    type="button"
                    disabled={pending || isRefreshing}
                    onClick={onReload}
                    className={button}
                  >
                    <RefreshCw aria-hidden className="h-4 w-4" />
                    {dirty
                      ? "Recharger et abandonner mes modifications"
                      : "Charger la version actuelle"}
                  </button>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs leading-6 text-slate-600">
                  {dirty
                    ? "Enregistrez vos modifications avant d’approuver. Le texte local reste dans ce studio pendant vos déplacements entre les avis."
                    : run.source === "takatak"
                      ? "La validation conserve ce texte pour le suivi interne. Elle n’envoie aucune réponse publique."
                      : "L’approbation porte sur le texte enregistré. La publication sera confirmée séparément par la source."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    name="intent"
                    value="approve"
                    disabled={pending || approvalBlocked}
                    className={primary}
                  >
                    <Check aria-hidden className="h-4 w-4" /> Approuver ce texte
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value="reject"
                    disabled={pending || stale}
                    className={button}
                  >
                    <X aria-hidden className="h-4 w-4" /> Refuser
                  </button>
                </div>
              </div>
            </>
          )}
          {!editable && (dirty || stale) && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
              Ce traitement ne permet plus de modifier le texte. Votre version
              locale reste visible ci-dessus.
            </p>
          )}
          {feedback && (
            <p
              role="status"
              className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-6 text-blue-900"
            >
              {feedback}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-800"
            >
              {error}
            </p>
          )}
        </form>

        <div className="space-y-2 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-600">
          <p>
            {confirmed
              ? "Le texte de réponse a été confirmé auprès de la source."
              : run.source === "takatak" &&
                  ["completed", "approved", "executing"].includes(statusKey)
                ? statusKey === "completed"
                  ? "Le suivi interne est terminé. Aucune publication publique n’est attendue pour ce traitement."
                  : "Ce traitement concerne le suivi interne de l’équipe."
                : status.detail}
          </p>
          {confirmed && run.publishedAt && (
            <p className="inline-flex flex-wrap items-center gap-x-2 font-medium text-emerald-800">
              <ShieldCheck aria-hidden className="h-4 w-4" />
              Réponse confirmée par la source :{" "}
              <Timestamp value={run.publishedAt} />
            </p>
          )}
          {run.decidedAt && (
            <p>
              Décision enregistrée : <Timestamp value={run.decidedAt} />
            </p>
          )}
          <p className="tabular-nums">
            Crédits déclarés par le traitement : {run.creditsDebited}
          </p>
          {run.error && (
            <p className="break-words text-rose-700">{run.error}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function ReviewApprovalCenter({
  runs,
  canApprove,
  canManage,
  decisionAction,
  editAction,
  unavailable = false,
}: {
  runs: ReviewApprovalRun[];
  canApprove: boolean;
  canManage: boolean;
  decisionAction: DecisionAction;
  editAction: EditAction;
  unavailable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<StatusGroup>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Sessions>({});
  const [isRefreshing, startRefresh] = useTransition();
  const router = useRouter();
  const refresh = () => startRefresh(() => router.refresh());
  const canDecide = canApprove && canManage;
  const shown = useMemo(() => {
    const search = query.toLocaleLowerCase().trim();
    return runs
      .filter((run) => {
        const status = effectiveStatus(run, sessions[run.id]);
        return (
          (group === "all" ||
            (group === "approval" && status === "awaiting_approval") ||
            (group === "processing" && PROCESSING.has(status)) ||
            (group === "finished" && FINISHED.has(status)) ||
            (group === "failed" && status === "failed")) &&
          (!search ||
            [
              run.author,
              run.location,
              run.source,
              run.reviewText || "",
              run.draft || "",
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(search))
        );
      })
      .sort(
        (a, b) =>
          Number(effectiveStatus(b, sessions[b.id]) === "awaiting_approval") -
            Number(
              effectiveStatus(a, sessions[a.id]) === "awaiting_approval",
            ) ||
          b.createdAt.localeCompare(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
  }, [runs, query, group, sessions]);
  const selected = shown.find((run) => run.id === selectedId) ?? shown[0];
  const selectedIndex = selected
    ? shown.findIndex((run) => run.id === selected.id)
    : -1;
  const session = selected
    ? (sessions[selected.id] ?? newSession(selected))
    : null;
  const awaiting = runs.filter(
    (run) => effectiveStatus(run, sessions[run.id]) === "awaiting_approval",
  ).length;
  const processing = runs.filter((run) =>
    PROCESSING.has(effectiveStatus(run, sessions[run.id])),
  ).length;
  const confirmed = runs.filter(sourceConfirmed).length;
  const unsaved = runs.filter((run) => {
    const item = sessions[run.id];
    return item && item.text !== item.savedDraft;
  }).length;
  const nextAwaiting = [
    ...shown.slice(selectedIndex + 1),
    ...shown.slice(0, Math.max(0, selectedIndex)),
  ].find(
    (run) => effectiveStatus(run, sessions[run.id]) === "awaiting_approval",
  );
  const updateSession = (
    run: ReviewApprovalRun,
    update: (previous: EditorSession) => EditorSession,
  ) =>
    setSessions((previous) => ({
      ...previous,
      [run.id]: update(previous[run.id] ?? newSession(run)),
    }));

  return (
    <Card className="overflow-hidden">
      <section aria-label="Review approval center">
        <header className="relative overflow-hidden bg-[#060D1F] p-5 text-white sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#1565D8]/20 blur-3xl"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#29C3FF]">
                TAKATAK · Review
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                Studio de réponses IA
              </h2>
              <p className="mt-2 text-xs leading-6 text-slate-300">
                Un avis, une réponse, une décision. Ajustez le brouillon à votre
                voix avant de l’approuver.
              </p>
            </div>
            <div className="hidden rounded-xl border border-white/15 bg-white/5 p-3 sm:block">
              <ClipboardCheck aria-hidden className="h-5 w-5 text-[#29C3FF]" />
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "À approuver", value: awaiting },
              { label: "En traitement", value: processing },
              { label: "Confirmées par la source", value: confirmed },
            ].map((item) => (
              <div
                key={item.label}
                className="min-w-0 rounded-xl border border-white/15 bg-white/5 px-3 py-3 sm:px-4"
              >
                <p className="break-words text-[10px] leading-4 text-slate-300 sm:text-[11px]">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {unavailable ? "—" : item.value}
                </p>
              </div>
            ))}
          </div>
        </header>

        <div className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-[11px] leading-6 text-slate-600">
              Indicateurs des traitements chargés dans cet espace. L’approbation
              et la confirmation de publication restent distinctes; les crédits
              sont les montants déclarés par le service IA.
            </p>
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className={button}
            >
              <RefreshCw aria-hidden className="h-4 w-4" />{" "}
              {isRefreshing ? "Actualisation…" : "Actualiser"}
            </button>
          </div>
          {unavailable ? (
            <p
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
            >
              Les traitements n’ont pas pu être chargés. Actualisez cette vue
              avant de prendre une décision.
            </p>
          ) : (
            <>
              {!canDecide && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                  {canManage
                    ? "Votre rôle doit aussi permettre l’approbation du contenu pour modifier et décider dans cette vue."
                    : "Accès en lecture : la gestion de réputation et l’approbation du contenu sont nécessaires pour modifier et décider."}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <label className="relative w-full sm:max-w-sm">
                  <span className="sr-only">Rechercher un traitement IA</span>
                  <Search
                    aria-hidden
                    className="absolute left-3 top-3 h-4 w-4 text-slate-600"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Client, établissement, texte…"
                    className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  />
                </label>
                <label>
                  <span className="sr-only">État du traitement IA</span>
                  <select
                    value={group}
                    onChange={(event) =>
                      setGroup(event.target.value as StatusGroup)
                    }
                    className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <option value="all">Tous les états</option>
                    <option value="approval">À approuver</option>
                    <option value="processing">En traitement</option>
                    <option value="finished">
                      Terminés, refusés ou annulés
                    </option>
                    <option value="failed">Échecs</option>
                  </select>
                </label>
                <p
                  role="status"
                  className="text-xs tabular-nums text-slate-600"
                >
                  {shown.length} sur {runs.length} traitements chargés
                </p>
              </div>
              {unsaved > 0 && (
                <p className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  <PencilLine aria-hidden className="h-3.5 w-3.5" />
                  {unsaved}{" "}
                  {unsaved > 1
                    ? "réponses locales non enregistrées"
                    : "réponse locale non enregistrée"}{" "}
                  · conservées pendant votre navigation dans ce studio.
                </p>
              )}

              {selected && session ? (
                <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(240px,310px)_minmax(0,1fr)]">
                  <aside
                    aria-label="File des réponses"
                    className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70"
                  >
                    <div className="border-b border-slate-200 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-900">
                        Votre file de réponses
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-600">
                        Les demandes à approuver apparaissent en premier.
                      </p>
                    </div>
                    <div className="max-h-44 overflow-y-auto p-2 sm:max-h-72 xl:max-h-[720px]">
                      {shown.map((run) => {
                        const status = STATUS[
                          effectiveStatus(run, sessions[run.id])
                        ] ?? { label: "État à vérifier" };
                        const dirty =
                          sessions[run.id] &&
                          sessions[run.id].text !== sessions[run.id].savedDraft;
                        return (
                          <button
                            key={run.id}
                            type="button"
                            aria-pressed={run.id === selected.id}
                            onClick={() => setSelectedId(run.id)}
                            className={[
                              "mb-1 block w-full rounded-xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                              run.id === selected.id
                                ? "border-blue-200 bg-blue-50 text-slate-900"
                                : "border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-white",
                            ].join(" ")}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0 break-words text-xs font-semibold">
                                {run.author}
                              </span>
                              {sourceConfirmed(run) && (
                                <ShieldCheck
                                  aria-label="Source confirmée"
                                  className="h-4 w-4 shrink-0 text-emerald-700"
                                />
                              )}
                            </span>
                            <span className="mt-1 block truncate text-[11px] leading-5">
                              {run.location}
                            </span>
                            <span className="mt-1 block text-[10px] font-medium leading-5 text-slate-600">
                              {reviewSource(run.source)?.name || run.source} ·{" "}
                              {status.label}
                            </span>
                            {dirty && (
                              <span className="mt-1 block text-[10px] font-semibold text-amber-900">
                                Texte local non enregistré
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </aside>

                  <div className="min-w-0 space-y-3">
                    <nav
                      aria-label="Parcourir les réponses"
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Réponse précédente"
                          disabled={selectedIndex <= 0}
                          onClick={() =>
                            setSelectedId(shown[selectedIndex - 1].id)
                          }
                          className={button}
                        >
                          <ChevronLeft aria-hidden className="h-4 w-4" />
                        </button>
                        <span className="text-xs tabular-nums text-slate-600">
                          {selectedIndex + 1} / {shown.length}
                        </span>
                        <button
                          type="button"
                          aria-label="Réponse suivante"
                          disabled={selectedIndex >= shown.length - 1}
                          onClick={() =>
                            setSelectedId(shown[selectedIndex + 1].id)
                          }
                          className={button}
                        >
                          <ChevronRight aria-hidden className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={!nextAwaiting}
                        onClick={() =>
                          nextAwaiting && setSelectedId(nextAwaiting.id)
                        }
                        className={button}
                      >
                        <ArrowDown aria-hidden className="h-4 w-4" /> Prochaine
                        à approuver
                      </button>
                    </nav>
                    <ReviewEditor
                      key={selected.id + ":" + session.revision}
                      run={selected}
                      session={session}
                      canDecide={canDecide}
                      isRefreshing={isRefreshing}
                      decisionAction={decisionAction}
                      editAction={editAction}
                      onChange={(value) =>
                        updateSession(selected, (previous) => ({
                          ...previous,
                          text: value,
                          message: null,
                          error: null,
                        }))
                      }
                      onReload={() =>
                        updateSession(selected, (previous) =>
                          previous.locallySaved &&
                          selected.draftHash === previous.propHash
                            ? {
                                ...previous,
                                text: previous.savedDraft,
                                needsReload: false,
                                error: null,
                                message: null,
                                revision: previous.revision + 1,
                              }
                            : {
                                ...newSession(selected),
                                revision: previous.revision + 1,
                              },
                        )
                      }
                      onSaved={(result, submittedText) =>
                        updateSession(selected, (previous) => ({
                          ...previous,
                          text:
                            previous.text === submittedText
                              ? result.draft
                              : previous.text,
                          savedDraft: result.draft,
                          hash: result.draftHash,
                          locallySaved: true,
                          needsReload: false,
                          message: result.message,
                          error: null,
                        }))
                      }
                      onDecision={(kind, version, message) =>
                        updateSession(selected, (previous) => ({
                          ...previous,
                          decision: { kind, hash: version, message },
                          error: null,
                          message: null,
                        }))
                      }
                      onPending={(pending) => {
                        setSelectedId((previous) => previous || selected.id);
                        updateSession(selected, (previous) => ({
                          ...previous,
                          pending,
                        }));
                      }}
                      onFailure={(error) => {
                        updateSession(selected, (previous) => ({
                          ...previous,
                          error,
                          message: null,
                          needsReload: !/^Saisissez/.test(error),
                        }));
                        refresh();
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                  <Inbox
                    aria-hidden
                    className="mx-auto h-6 w-6 text-slate-500"
                  />
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">
                    {runs.length
                      ? "Aucun traitement ne correspond aux filtres"
                      : "Aucun traitement de réponse enregistré"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-slate-600">
                    {runs.length
                      ? "Essayez un autre texte ou affichez tous les états. Vos modifications locales sont conservées."
                      : "Demandez un brouillon depuis un avis pris en charge pour suivre sa génération et son approbation ici."}
                  </p>
                  {runs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setGroup("all");
                      }}
                      className={button + " mt-4"}
                    >
                      Réinitialiser les filtres
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          <Link
            href="/dashboard/growth/ai-engine"
            className="inline-flex rounded text-xs font-semibold text-[#1565D8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Consulter l’équipe IA et les traitements
          </Link>
        </div>
      </section>
    </Card>
  );
}
