import { redirect } from "next/navigation";
import { ArrowUpRight, Ticket } from "lucide-react";

import { AlkaoFrame } from "@/components/ticketing/alkao-frame";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasAlkaoTicketing } from "@/lib/ticketing/alkao-access";
import { getAlkaoOpsOrigin } from "@/lib/ticketing/alkao-config";

export const dynamic = "force-dynamic";

/**
 * ALKAO — Billetterie. The ticketing operations app (events, sessions,
 * orders, refunds, Flex Météo, gate scanning, Stripe) runs in ALKAO and is
 * framed here. Hiding this menu is not a security measure: ALKAO checks the
 * user's token, membership, role and Ticketing entitlement on every call.
 */
export default async function TicketingDashboardPage() {
  const { access } = await getServerAccessContext();
  const enabled = hasAlkaoTicketing(access);

  if (!enabled) {
    redirect("/dashboard");
  }

  const opsOrigin = getAlkaoOpsOrigin();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Ticket className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              ALKAO — Billetterie
            </h1>
            <p className="text-xs text-slate-500">
              Events, orders, refunds and gate control, run by ALKAO.
            </p>
          </div>
        </div>
        {opsOrigin ? (
          <a
            href={`${opsOrigin}/ops`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Open ALKAO on its own (camera scanner)
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>

      {opsOrigin ? (
        <AlkaoFrame opsOrigin={opsOrigin} />
      ) : (
        <Card>
          <CardHeader
            title="ALKAO is not connected to this dashboard yet"
            subtitle="Setup required"
          />
          <CardBody className="space-y-2 text-sm text-slate-600">
            <p>
              Set <code>ALKAO_OPS_URL</code> (the HTTPS URL of the ALKAO
              deployment) on this server, then add this dashboard&apos;s origin
              to <code>ALKAO_OPS_FRAME_ANCESTORS</code> on ALKAO.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
