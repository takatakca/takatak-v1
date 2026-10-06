import { FacturationsPayButton } from "@/components/billing/facturations-pay-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getClientInvoices } from "@/lib/billing/client-invoices/client-invoice-service";
import {
  formatMinor,
  summarizeClientInvoices,
  type ClientInvoiceStatus,
} from "@/lib/billing/client-invoices/invoice-view";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ClientInvoiceStatus, string> = {
  paid: "Payée",
  open: "À payer",
  overdue: "En retard",
  void: "Annulée",
  uncollectible: "Irrécouvrable",
  refunded: "Remboursée",
};

const SOURCE_LABELS = {
  stripe: "Abonnement",
  facturations: "Facture de services",
} as const;

const STATUS_TONES: Record<ClientInvoiceStatus, "success" | "warning" | "danger" | "muted"> = {
  paid: "success",
  open: "warning",
  overdue: "danger",
  void: "muted",
  uncollectible: "muted",
  refunded: "muted",
};

function day(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeZone: "America/Toronto" }).format(new Date(value))
    : "—";
}

const PAYMENT_NOTICES: Record<string, { tone: string; text: string }> = {
  success: {
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    text: "Merci! Stripe a reçu votre paiement. La facture sera marquée payée dès sa confirmation, en général en moins d’une minute.",
  },
  cancelled: {
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    text: "Paiement annulé. Aucun montant n’a été prélevé.",
  },
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string | string[] }>;
}) {
  const { payment } = await searchParams;
  const notice = typeof payment === "string" && Object.hasOwn(PAYMENT_NOTICES, payment) ? PAYMENT_NOTICES[payment] : undefined;
  const access = await requireWorkspacePermission("manage_settings", "/dashboard/invoices");
  const result = await getClientInvoices(access.activeClientId);
  const invoices = result.status === "ok" ? result.invoices : [];
  const summary = summarizeClientInvoices(invoices);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
          GROUPE TAKATAK
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Factures</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Les factures que GROUPE TAKATAK vous a envoyées pour vos abonnements et services. Payez en ligne ou
          téléchargez le PDF.
        </p>
      </div>

      {notice ? (
        <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${notice.tone}`}>
          {notice.text}
        </p>
      ) : null}

      {result.status === "ok" ? (
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Résumé">
          <Card>
            <CardBody>
              <p className="text-xs font-medium text-slate-500">Solde à payer</p>
              <p className="mt-2 text-xl font-bold text-slate-950">
                {formatMinor(summary.outstandingMinor, summary.currency)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-medium text-slate-500">Factures en retard</p>
              <p className={`mt-2 text-xl font-bold ${summary.overdueCount > 0 ? "text-rose-600" : "text-slate-950"}`}>
                {summary.overdueCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-medium text-slate-500">Dernier paiement</p>
              <p className="mt-2 text-xl font-bold text-slate-950">{day(summary.lastPaidAt)}</p>
            </CardBody>
          </Card>
        </section>
      ) : null}

      <Card>
        <CardHeader
          title="Historique des factures"
          subtitle={
            result.status === "ok" && result.partial
              ? "Une partie de l’historique n’a pas pu être chargée. Réessayez dans quelques minutes."
              : "Les 24 dernières factures par compte de facturation."
          }
        />
        <CardBody className="overflow-x-auto p-0">
          {result.status === "no_billing_account" ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              Aucun compte de facturation n’est encore associé à cet espace. Vos factures apparaîtront ici dès votre
              premier abonnement payant.
            </p>
          ) : result.status === "unavailable" ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              Vos factures sont temporairement indisponibles. Réessayez dans quelques minutes.
            </p>
          ) : invoices.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Aucune facture pour le moment.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2">Facture</th>
                  <th className="px-5 py-2">Date</th>
                  <th className="px-5 py-2">Échéance</th>
                  <th className="px-5 py-2 text-right">Total</th>
                  <th className="px-5 py-2">Statut</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{invoice.number ?? "Facture"}</div>
                      <div className="text-xs text-slate-400">{SOURCE_LABELS[invoice.source]}</div>
                      {invoice.description ? (
                        <div className="max-w-xs truncate text-xs text-slate-500">{invoice.description}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{day(invoice.issuedAt)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{day(invoice.dueAt)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-slate-900">
                      {formatMinor(invoice.totalMinor, invoice.currency)}
                      {invoice.amountDueMinor > 0 && invoice.amountDueMinor !== invoice.totalMinor ? (
                        <div className="text-xs font-normal text-amber-700">
                          Reste {formatMinor(invoice.amountDueMinor, invoice.currency)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONES[invoice.status]}>{STATUS_LABELS[invoice.status]}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <div className="flex justify-end gap-3 text-sm">
                        {invoice.checkoutRequestId ? (
                          <FacturationsPayButton requestId={invoice.checkoutRequestId} />
                        ) : null}
                        {invoice.payUrl ? (
                          <a
                            href={invoice.payUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-indigo-600 hover:text-indigo-500"
                          >
                            {invoice.status === "paid" ? "Voir" : "Payer"}
                          </a>
                        ) : null}
                        {invoice.pdfUrl ? (
                          <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-600 hover:text-slate-900"
                          >
                            PDF
                          </a>
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

      <p className="text-xs text-slate-500">
        Paiements sécurisés par Stripe. Une facture de services passe à « Payée » seulement après la confirmation du
        paiement par Stripe.
      </p>
    </div>
  );
}
