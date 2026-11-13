"use client";
import { useActionState } from "react";
import { RefreshCw, Download } from "lucide-react";
import { syncQmapsReviewsAction } from "@/app/dashboard/growth/reviews/qmaps-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
type Connection = {
  id: string;
  name: string;
  city: string | null;
  businessId: string;
  linkConfirmed: boolean;
  hasOlder: boolean;
  lastPulledAt: string | null;
};
function ConnectionRow({
  connection,
  canManage,
}: {
  connection: Connection;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(syncQmapsReviewsAction, {
    ok: null,
  });
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {connection.name}
            {connection.city ? ` · ${connection.city}` : ""}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Dernière lecture API :{" "}
            {connection.lastPulledAt
              ? new Date(connection.lastPulledAt).toLocaleString("fr-CA", {
                  timeZone: "America/Toronto",
                })
              : "aucune lecture confirmée"}
          </p>
        </div>
        <Badge>
          {connection.linkConfirmed
            ? "Lien entreprise confirmé"
            : "Lien enregistré dans TAKATAK"}
        </Badge>
      </div>
      <form
        action={action}
        aria-busy={pending}
        className="mt-4 flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="listingId" value={connection.id} />
        <button
          name="mode"
          value="latest"
          disabled={!canManage || pending}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1565D8] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          <RefreshCw aria-hidden className="h-4 w-4" />
          {pending ? "Lecture…" : "Actualiser les avis"}
        </button>
        <button
          name="mode"
          value="older"
          disabled={
            !canManage ||
            pending ||
            !(state.ok === true && "fetched" in state
              ? state.hasMore
              : connection.hasOlder)
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
        >
          <Download aria-hidden className="h-4 w-4" />
          Charger les avis plus anciens
        </button>
        <button
          name="mode"
          value="visibility"
          disabled={!canManage || pending}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
        >
          Vérifier les avis retirés
        </button>
      </form>
      {state.ok === true && "checked" in state && (
        <p role="status" className="mt-3 text-xs leading-6 text-slate-600">
          {state.checked} identifiants vérifiés auprès de QMAPS ·{" "}
          {state.archived} avis retirés archivés dans TAKATAK.{" "}
          {state.hasMore
            ? "Relancez pour contrôler la prochaine tranche."
            : "Fin de cette série de vérification."}
        </p>
      )}
      {state.ok === true && "fetched" in state && (
        <p role="status" className="mt-3 text-xs leading-6 text-slate-600">
          {state.fetched} avis lus · {state.created} ajoutés · {state.updated}{" "}
          actualisés · {state.skipped} versions anciennes ignorées.{" "}
          {state.hasMore
            ? "Une autre page est disponible."
            : "Fin des pages disponibles."}{" "}
          Les autres avis déjà suivis restent conservés.
        </p>
      )}
      {state.ok === false && (
        <p role="alert" className="mt-3 text-xs leading-6 text-rose-700">
          {state.error}
        </p>
      )}
    </div>
  );
}
export function QmapsReviewConnection({
  connections,
  canManage,
}: {
  connections: Connection[];
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title="QMAPS · synchronisation API"
        subtitle="Lire les avis de chaque entreprise liée, puis répondre depuis la boîte d'avis TAKATAK."
      />
      <CardBody className="space-y-4">
        <p className="text-xs leading-6 text-slate-500">
          Une lecture récupère jusqu’à 25 avis visibles de l’entreprise
          autorisée. La vérification des retraits contrôle jusqu’à 100 avis déjà
          suivis par appel; une absence dans une page ne suffit jamais à retirer
          un avis. L’accès aux avis et la publication sont contrôlés sur les
          deux plateformes.
        </p>
        {connections.map((connection) => (
          <ConnectionRow
            key={connection.id}
            connection={connection}
            canManage={canManage}
          />
        ))}
        {!connections.length && (
          <p className="text-sm text-slate-600">
            Aucune entreprise QMAPS liée à cet espace. Un administrateur peut
            créer le lien dans Admin → QMAPS.
          </p>
        )}
        {!canManage && (
          <p className="text-xs text-slate-500">
            Le rôle de gestion de réputation est requis pour lancer une
            synchronisation.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
