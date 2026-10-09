import Link from "next/link";

import { ClientConnectButton } from "@/components/billing/client-connect-button";
import { ClientInvoiceActions } from "@/components/billing/client-invoice-actions";
import { ClientInvoiceForm } from "@/components/billing/client-invoice-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  getClientConnectStatus,
  syncClientConnectAccount,
  type ClientConnectStatus,
} from "@/lib/billing/client-invoicing/connect-service";
import type { ClientConnectState } from "@/lib/billing/client-invoicing/connect-policy";
import {
  canActOnClientInvoice,
  filterClientIssuedInvoices,
  parseClientInvoiceFilter,
  summarizeClientIssuedInvoices,
  type ClientInvoiceFilter,
} from "@/lib/billing/client-invoicing/invoice-actions";
import { listClientIssuedInvoices } from "@/lib/billing/client-invoicing/invoice-service";
import { formatMinor, type ClientInvoiceStatus } from "@/lib/billing/client-invoices/invoice-view";
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

// Partial on purpose: statuses added to the shared view later fall back to "muted".
const INVOICE_STATUS: Partial<Record<ClientInvoiceStatus, { label: string; tone: "success" | "warning" | "danger" | "muted" }>> = {
  paid: { label: "Payée", tone: "success" },
  open: { label: "Envoyée", tone: "warning" },
  overdue: { label: "En retard", tone: "danger" },
  void: { label: "Annulée", tone: "muted" },
  uncollectible: { label: "Irrécouvrable", tone: "muted" },
};

const FILTERS: Array<{ key: ClientInvoiceFilter; label: string }> = [
  { key: "all", label: "Toutes" },
  { key: "unpaid", label: "À encaisser" },
  { key: "overdue", label: "En retard" },
  { key: "paid", label: "Payées" },
];

function day(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeZone: "America/Toronto" }).format(new Date(value))
    : "—";
}

export default async function ClientBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string | string[]; filtre?: string | string[] }>;
}) {
  const access = await requireWorkspacePermission("manage_settings", "/dashboard/client-billing");
  const { connect, filtre } = await searchParams;
  const filter = parseClientInvoiceFilter(filtre);
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
  const issued = status.enabled && status.state === "active" ? await listClientIssuedInvoices(access.activeClientId) : null;
  const summary = issued?.status === "ok" ? summarizeClientIssuedInvoices(issued.invoices) : null;
  const shown = issued?.status === "ok" ? filterClientIssuedInvoices(issued.invoices, filter) : [];

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

      {summary ? (
        <section aria-label="Résumé" className="grid gap-4 sm:grid-cols-3">
          <SummaryTile
            label="À encaisser"
            value={formatMinor(summary.outstandingMinor, summary.currency)}
            detail={`${summary.outstandingCount} facture${summary.outstandingCount > 1 ? "s" : ""} ouverte${summary.outstandingCount > 1 ? "s" : ""}`}
          />
          <SummaryTile
            label="En retard"
            value={formatMinor(summary.overdueMinor, summary.currency)}
            detail={summary.overdueCount > 0 ? `${summary.overdueCount} facture${summary.overdueCount > 1 ? "s" : ""} à relancer` : "Aucune facture en retard"}
            tone={summary.overdueCount > 0 ? "danger" : "muted"}
          />
          <SummaryTile
            label="Payé (30 derniers jours)"
            value={formatMinor(summary.paidLast30DaysMinor, summary.currency)}
            detail={`${summary.paidLast30DaysCount} paiement${summary.paidLast30DaysCount > 1 ? "s" : ""}`}
          />
          {summary.otherCurrencyCount > 0 ? (
            <p className="text-xs text-slate-500 sm:col-span-3">
              Montants en {summary.currency}. {summary.otherCurrencyCount} facture{summary.otherCurrencyCount > 1 ? "s" : ""} dans une autre devise {summary.otherCurrencyCount > 1 ? "ne sont" : "n’est"} pas comptée{summary.otherCurrencyCount > 1 ? "s" : ""}.
            </p>
          ) : null}
        </section>
      ) : null}

      {status.enabled && status.state === "active" ? (
        <>
          <Card>
            <CardHeader title="Nouvelle facture" subtitle="Envoyée par Stripe depuis votre compte, payable en ligne par votre client." />
            <CardBody>
              <ClientInvoiceForm />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Factures envoyées" subtitle="Les 100 dernières factures de votre compte Stripe." />
            <CardBody className="overflow-x-auto p-0">
              {issued?.status === "ok" && issued.invoices.length > 0 ? (
                <nav aria-label="Filtrer les factures" className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
                  {FILTERS.map((item) => (
                    <Link
                      key={item.key}
                      href={item.key === "all" ? "/dashboard/client-billing" : `/dashboard/client-billing?filtre=${item.key}`}
                      aria-current={filter === item.key ? "page" : undefined}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${filter === item.key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              ) : null}
              {issued?.status === "unavailable" ? (
                <p className="px-5 py-6 text-sm text-slate-500">Vos factures sont temporairement indisponibles.</p>
              ) : issued?.status !== "ok" || issued.invoices.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">Aucune facture envoyée pour le moment.</p>
              ) : shown.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">Aucune facture dans cette catégorie.</p>
              ) : (
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-2">Facture</th>
                      <th className="px-5 py-2">Date</th>
                      <th className="px-5 py-2">Échéance</th>
                      <th className="px-5 py-2 text-right">Total</th>
                      <th className="px-5 py-2 text-right">Reste dû</th>
                      <th className="px-5 py-2">Statut</th>
                      <th className="px-5 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shown.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-5 py-3 font-medium text-slate-900">{invoice.number ?? "Facture"}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">{day(invoice.issuedAt)}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">{day(invoice.dueAt)}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-slate-900">
                          {formatMinor(invoice.totalMinor, invoice.currency)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">
                          {canActOnClientInvoice(invoice.status) ? formatMinor(invoice.amountDueMinor, invoice.currency) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={INVOICE_STATUS[invoice.status]?.tone ?? "muted"}>
                            {INVOICE_STATUS[invoice.status]?.label ?? invoice.status}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <div className="flex items-start justify-end gap-3">
                            {canActOnClientInvoice(invoice.status) ? (
                              <ClientInvoiceActions invoiceId={invoice.id} remindable={invoice.remindable} />
                            ) : null}
                            {invoice.payUrl ? (
                              <a href={invoice.payUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-500">Voir</a>
                            ) : null}
                            {invoice.pdfUrl ? (
                              <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-900">PDF</a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      <p className="text-xs text-slate-500">
        La configuration se fait sur la page sécurisée de Stripe. Stripe vérifie l’identité de votre entreprise et
        prélève ses frais directement sur votre compte.
      </p>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
  tone = "muted",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "danger" | "muted";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-rose-600" : "text-slate-950"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
