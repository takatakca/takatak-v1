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
  { name: "Bulle de clavardage · Website chat", detail: "Une fenêtre de clavardage sur votre site, dirigée vers votre équipe ou le concierge IA · Routed to your team or the AI concierge." },
  { name: "WhatsApp Business", detail: "WhatsApp dans les deux sens depuis le tableau de bord, avec modèles de rappels et d’avis · Two-way WhatsApp with templates." },
  { name: "Messenger", detail: "Les messages de votre page Facebook dans la même boîte · Facebook page messages in the same inbox." },
  { name: "Texto dans les deux sens · Two-way SMS", detail: "Écrivez aux clients depuis le numéro de l’entreprise · Text customers from the business number." },
  { name: "Première réponse IA · AI first reply", detail: "Répond aux questions fréquentes, recueille le nom et le téléphone, et crée le prospect · Answers FAQs and captures the lead." },
  { name: "Transfert en prospect · Lead hand-off", detail: "Chaque conversation qui devient un prospect arrive dans le pipeline · Every new lead lands in the pipeline." },
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
        description="Tous les messages des clients (clavardage du site, WhatsApp, Messenger, texto) dans une seule boîte, l’IA répondant en premier · Every customer message in one inbox, with AI answering first."
        badges={[{ label: inbox ? "Clavardage en marche · Web chat live" : "Bouton WhatsApp en marche · WhatsApp button live", tone: "success" }]}
        actions={
          <Link href="/dashboard/social/inbox" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300">
            Boîte sociale · Social inbox →
          </Link>
        }
      />

      {inbox ? (
        <InboxPanel data={inbox} canManage={access.mode === "client_scoped" && hasEffectivePermission(access, "manage_conversations")} origin={origin} status={status} />
      ) : (
        <HonestyNote>
          {unavailable
            ? "La base des conversations est injoignable pour le moment : la boîte est masquée plutôt qu’incomplète · The conversations database is not reachable right now, so the inbox is hidden."
            : "Choisissez un espace client pour installer son clavardage et répondre aux conversations · Select a client workspace to install its website chat and answer conversations."}
        </HonestyNote>
      )}

      <Card>
        <CardHeader
          title="Bouton WhatsApp · WhatsApp chat button"
          subtitle="Fonctionne dès aujourd’hui, sans API : un bouton flottant qui ouvre WhatsApp avec l’entreprise · Works today without any API."
        />
        <CardBody>
          <WhatsAppButtonBuilder />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Boîte unifiée · Unified inbox" />
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
        <h2 className="text-sm font-semibold text-slate-900">Canaux de messagerie · Messaging channels</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>
          Les commentaires et messages privés des réseaux sociaux restent dans la boîte du module Social ; cette page ajoute les autres canaux. Aucun
          message n’est envoyé ni reçu avant qu’un canal soit branché et vérifié · Social comments and DMs stay in the Social inbox; no message is
          sent or received until a channel is connected and verified.
        </HonestyNote>
      </section>
    </div>
  );
}
