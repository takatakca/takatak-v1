import Link from "next/link";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { InboxPanel } from "@/components/chat/inbox-panel";
import { WhatsAppButtonBuilder } from "@/components/growth/whatsapp-button-builder";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getInboxSnapshot, type InboxSnapshot } from "@/lib/chat/service";
import { publicAppOrigin } from "@/lib/growth/public-origin";
import { getConnectorStatuses } from "@/lib/growth/status";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const dynamic = "force-dynamic";

const FEATURES = [
  { name: "Website chat bubble", detail: "Pop-up chat on every client site, routed to staff or the AI concierge." },
  { name: "WhatsApp Business", detail: "Two-way WhatsApp from the dashboard with templates for reminders and reviews." },
  { name: "Messenger", detail: "Facebook page messages in the same inbox." },
  { name: "Two-way SMS", detail: "Text customers from the business number." },
  { name: "AI first reply", detail: "Answers FAQs instantly, captures name and phone, and books the lead." },
  { name: "Lead hand-off", detail: "Every conversation that becomes a lead lands in the Leads pipeline." },
];

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/conversations");
  const status = (await searchParams).status === "closed" ? "closed" : "open";
  const scoped = access.mode === "client_scoped" && hasEffectivePermission(access, "view_conversations");
  let inbox: InboxSnapshot | null = null;
  let unavailable = false;
  if (scoped) {
    try {
      inbox = await getInboxSnapshot(access.activeClientId, status);
    } catch {
      unavailable = true;
      console.error("[chat] inbox unavailable");
    }
  }
  const origin = await publicAppOrigin();
  const connectors = getConnectorStatuses().filter((c) => c.category === "messaging");

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Conversations"
        description="Every customer message (website chat, WhatsApp, Messenger and SMS) in one inbox, with AI answering first."
        badges={[{ label: inbox ? "Web chat live" : "WhatsApp button live", tone: "success" }]}
        actions={
          <Link href="/dashboard/social/inbox" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300">
            Social inbox →
          </Link>
        }
      />

      {inbox ? (
        <InboxPanel data={inbox} canManage={access.mode === "client_scoped" && hasEffectivePermission(access, "manage_conversations")} origin={origin} status={status} />
      ) : (
        <HonestyNote>
          {unavailable
            ? "The conversations database is not reachable right now, so the inbox is hidden."
            : "Select a client workspace to install its website chat and answer conversations."}
        </HonestyNote>
      )}

      <Card>
        <CardHeader title="WhatsApp chat button" subtitle="Works today without any API: a floating button that opens WhatsApp with the business." />
        <CardBody>
          <WhatsAppButtonBuilder />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Unified inbox" />
        <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{f.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{f.detail}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Messaging channels</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>
          Social comments and DMs stay in the Social module&apos;s inbox. This page adds the non-social channels alongside it. No message is sent
          or received until a channel is connected and verified.
        </HonestyNote>
      </section>
    </div>
  );
}
