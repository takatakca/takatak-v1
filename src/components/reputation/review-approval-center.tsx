"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, RefreshCw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { reviewSource } from "@/lib/reputation/sources";

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
  /** Set only from an actual source acknowledgement, never a completed run. */
  publishedAt?: string | null;
};

export type ReviewDraftDecisionState =
  { ok: null } | { ok: true; message: string } | { ok: false; error: string };

type DecisionAction = (
  previous: ReviewDraftDecisionState,
  form: FormData,
) => Promise<ReviewDraftDecisionState>;

type StatusGroup = "all" | "approval" | "processing" | "finished" | "failed";
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
    detail: "Relisez le texte enregistré avant de décider de son exécution.",
  },
  approved: {
    label: "Approuvé · en attente d’exécution",
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

function DecisionForm({
  run,
  decisionAction,
}: {
  run: ReviewApprovalRun;
  decisionAction: DecisionAction;
}) {
  const [state, action, pending] = useActionState(decisionAction, { ok: null });
  const approvalBlocked = !run.draft || !!run.blockedReason;
  return (
    <form action={action} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="runId" value={run.id} />
      <input
        type="hidden"
        name="expectedDraftHash"
        value={run.draftHash ?? ""}
      />
      <p className="text-xs leading-5 text-slate-600">
        {approvalBlocked
          ? "Ce traitement reste disponible pour un refus. Un nouveau brouillon valide est nécessaire avant de l’approuver."
          : run.source === "takatak"
            ? "Votre validation conserve ce texte pour le suivi interne. Elle n’envoie aucune réponse publique."
            : "Votre approbation porte sur le texte affiché. Le serveur vérifie sa version avant d’enregistrer la décision."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={approvalBlocked || pending || state.ok === true}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1565D8] px-4 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
        >
          <Check aria-hidden className="h-4 w-4" />
          {pending ? "Enregistrement…" : "Approuver ce texte"}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending || state.ok === true}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
        >
          <X aria-hidden className="h-4 w-4" /> Refuser
        </button>
      </div>
      {state.ok === true && (
        <p role="status" className="text-xs leading-5 text-slate-700">
          {state.message}
        </p>
      )}
      {state.ok === false && (
        <p role="alert" className="text-xs leading-5 text-rose-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function RunCard({
  run,
  canDecide,
  decisionAction,
}: {
  run: ReviewApprovalRun;
  canDecide: boolean;
  decisionAction: DecisionAction;
}) {
  const status = STATUS[run.status] ?? {
    label: "État à vérifier",
    tone: "neutral" as const,
    detail: "Actualisez les traitements pour vérifier leur état.",
  };
  const sourceConfirmed =
    !!run.publishedAt && Number.isFinite(Date.parse(run.publishedAt));
  const hasDecision = run.status === "awaiting_approval" && !!run.draftHash;
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-slate-900">
            {run.author}
          </h3>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">
            {reviewSource(run.source)?.name || run.source} · {run.location}
            {run.rating !== null ? ` · ${run.rating}/5` : ""}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            Demande du <Timestamp value={run.createdAt} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          {sourceConfirmed && <Badge tone="success">Source confirmée</Badge>}
        </div>
      </div>
      {run.reviewText && (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Avis concerné
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
            {run.reviewText}
          </p>
        </div>
      )}
      {run.draft ? (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-900">
            Brouillon enregistré
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-900">
            {run.draft}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-6 text-slate-600">
          Aucun brouillon généré n’est enregistré pour ce traitement.
        </p>
      )}
      <div className="mt-4 space-y-2 text-xs leading-5 text-slate-600">
        <p>
          {sourceConfirmed
            ? "Le texte de réponse a été confirmé auprès de la source."
            : run.source === "takatak" &&
                ["completed", "approved", "executing"].includes(run.status)
              ? run.status === "completed"
                ? "Le traitement de suivi interne est terminé. Aucune publication publique n’est attendue pour ce traitement."
                : "Ce traitement concerne le suivi interne de l’équipe."
              : status.detail}
        </p>
        {sourceConfirmed && run.publishedAt && (
          <p className="font-medium text-emerald-800">
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
        {run.error && <p className="break-words text-rose-700">{run.error}</p>}
      </div>
      {hasDecision && canDecide && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <DecisionForm
            key={`${run.id}:${run.draftHash}:${run.status}`}
            run={run}
            decisionAction={decisionAction}
          />
        </div>
      )}
      {run.status === "awaiting_approval" &&
        (run.blockedReason || !run.draft || !hasDecision) && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            {run.blockedReason ||
              (run.draftHash
                ? "Le texte à approuver n’est pas disponible. Vous pouvez refuser ce traitement et demander un nouveau brouillon."
                : "La version du brouillon n’est pas disponible. Actualisez les traitements avant de décider.")}
          </p>
        )}
    </article>
  );
}

export function ReviewApprovalCenter({
  runs,
  canApprove,
  canManage,
  decisionAction,
  unavailable = false,
}: {
  runs: ReviewApprovalRun[];
  canApprove: boolean;
  canManage: boolean;
  decisionAction: DecisionAction;
  unavailable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<StatusGroup>("all");
  const router = useRouter();
  const canDecide = canApprove && canManage;
  const shown = useMemo(() => {
    const search = query.toLocaleLowerCase().trim();
    return runs
      .filter(
        (run) =>
          (group === "all" ||
            (group === "approval" && run.status === "awaiting_approval") ||
            (group === "processing" && PROCESSING.has(run.status)) ||
            (group === "finished" && FINISHED.has(run.status)) ||
            (group === "failed" && run.status === "failed")) &&
          (!search ||
            `${run.author} ${run.location} ${run.source} ${run.reviewText || ""} ${run.draft || ""}`
              .toLocaleLowerCase()
              .includes(search)),
      )
      .sort(
        (a, b) =>
          Number(b.status === "awaiting_approval") -
            Number(a.status === "awaiting_approval") ||
          b.createdAt.localeCompare(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
  }, [runs, query, group]);
  const awaiting = runs.filter(
    (run) => run.status === "awaiting_approval",
  ).length;
  const processing = runs.filter((run) => PROCESSING.has(run.status)).length;
  const confirmed = runs.filter(
    (run) => run.publishedAt && Number.isFinite(Date.parse(run.publishedAt)),
  ).length;
  return (
    <Card>
      <section aria-label="Review approval center">
        <CardHeader
          title="Réponses IA · revue et approbation"
          subtitle="Retrouvez les traitements enregistrés, relisez leurs textes et décidez une réponse à la fois."
          action={
            <ClipboardCheck
              aria-hidden
              className="h-5 w-5 shrink-0 text-[#1565D8]"
            />
          }
        />
        <CardBody className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "À approuver", value: awaiting },
              { label: "En traitement", value: processing },
              { label: "Confirmées par la source", value: confirmed },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-xs text-slate-600">{item.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                  {unavailable ? "—" : item.value}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs leading-6 text-slate-600">
            Ces indicateurs concernent les traitements chargés dans cet espace.
            La génération et l’exécution utilisent le service IA configuré. Une
            approbation enregistre une décision; la confirmation de la source
            est suivie séparément. Les crédits affichés sont les montants
            déclarés par les traitements enregistrés.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/growth/ai-engine"
              className="rounded text-xs font-semibold text-[#1565D8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Consulter l’équipe IA et les traitements
            </Link>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <RefreshCw aria-hidden className="h-4 w-4" /> Actualiser
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
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                  {canManage
                    ? "Votre rôle doit aussi permettre l’approbation du contenu pour décider dans cette vue."
                    : "Accès en lecture : la gestion de réputation et l’approbation du contenu sont nécessaires pour décider."}
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
                    className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  />
                </label>
                <label className="text-xs text-slate-600">
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
              <div className="space-y-4">
                {shown.map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    canDecide={canDecide}
                    decisionAction={decisionAction}
                  />
                ))}
              </div>
              {!shown.length && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {runs.length
                      ? "Aucun traitement ne correspond aux filtres"
                      : "Aucun traitement de réponse enregistré"}
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-slate-600">
                    {runs.length
                      ? "Essayez un autre texte ou affichez tous les états."
                      : "Demandez un brouillon depuis un avis pris en charge pour suivre sa génération et son approbation ici."}
                  </p>
                  {runs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setGroup("all");
                      }}
                      className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#1565D8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      Réinitialiser les filtres
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </CardBody>
      </section>
    </Card>
  );
}
