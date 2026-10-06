import { ClientConnectButton } from "@/components/billing/client-connect-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  getClientConnectStatus,
  syncClientConnectAccount,
  type ClientConnectStatus,
} from "@/lib/billing/client-invoicing/connect-service";
import type { ClientConnectState } from "@/lib/billing/client-invoicing/connect-policy";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

const STATE_COPY: Record<ClientConnectState, { badge: string; tone: "success" | "warning" | "danger" | "muted"; text: string; action: string | null }> = {
  not_connected: {
    badge: "Non connecté",
    tone: "muted",
    text: "Connectez votre propre compte Stripe. Vous pourrez ensuite facturer vos clients depuis TAKATAK et être payé directement dans votre compte bancaire.",
    action: "Connecter mon compte Stripe",
  },
  onboarding: {
    badge: "Configuration à terminer",
    tone: "warning",
    text: "Stripe a besoin de quelques informations sur votre entreprise avant d’accepter des paiements.",
    action: "Terminer la configuration",
  },
  restricted: {
    badge: "Informations demandées",
    tone: "danger",
    text: "Stripe a reçu votre dossier mais demande encore des informations avant d’activer les paiements.",
    action: "Compléter mon dossier Stripe",
  },
  active: {
    badge: "Actif",
    tone: "success",
    text: "Votre compte Stripe est prêt. Les paiements de vos clients sont versés directement dans votre compte bancaire.",
    action: null,
  },
};

export default async function ClientBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string | string[] }>;
}) {
  const access = await requireWorkspacePermission("manage_settings", "/dashboard/client-billing");
  const { connect } = await searchParams;
  let status: ClientConnectStatus = await getClientConnectStatus(access.activeClientId);
  let syncFailed = false;

  // Back from Stripe onboarding: re-read the account flags server-side.
  if ((connect === "return" || connect === "refresh") && status.state !== "not_connected") {
    try {
      status = await syncClientConnectAccount(access.activeClientId);
    } catch {
      syncFailed = true;
    }
  }

  const copy = STATE_COPY[status.state];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">GROUPE TAKATAK</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Facturer mes clients</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Envoyez des factures à vos propres clients et recevez leurs paiements directement. Les factures et les
          paiements restent dans votre compte Stripe : GROUPE TAKATAK ne détient jamais votre argent.
        </p>
      </div>

      {!status.enabled ? (
        <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          La facturation de vos clients arrive bientôt sur TAKATAK.
        </p>
      ) : null}

      {syncFailed ? (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nous n’avons pas pu relire votre compte Stripe. Réessayez dans quelques minutes.
        </p>
      ) : null}

      <Card>
        <CardHeader title="Compte Stripe" subtitle="Votre compte, vos clients, vos paiements." />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge tone={copy.tone}>{copy.badge}</Badge>
            {status.flags?.country ? (
              <span className="text-xs text-slate-500">
                {status.flags.country}
                {status.flags.defaultCurrency ? ` · ${status.flags.defaultCurrency.toUpperCase()}` : ""}
                {status.flags.payoutsEnabled ? " · virements activés" : ""}
              </span>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">{copy.text}</p>
          {status.enabled && copy.action ? <ClientConnectButton label={copy.action} /> : null}
          {status.state === "active" ? (
            <a
              href="https://dashboard.stripe.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Ouvrir mon tableau de bord Stripe
            </a>
          ) : null}
        </CardBody>
      </Card>

      <p className="text-xs text-slate-500">
        La configuration se fait sur la page sécurisée de Stripe. Stripe vérifie l’identité de votre entreprise et
        prélève ses frais directement sur votre compte.
      </p>
    </div>
  );
}
