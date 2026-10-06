import Link from "next/link";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { ReviewRequestBuilder } from "@/components/growth/review-request-builder";
import { ReputationWorkspace } from "@/components/reputation/reputation-workspace";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getConnectorStatuses } from "@/lib/growth/status";
import { publicAppOrigin } from "@/lib/growth/public-origin";
import { growthSmsConfigured, growthWhatsAppConfigured } from "@/lib/messaging/delivery";
import { getReputationSnapshot, type ReputationSnapshot } from "@/lib/reputation/service";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const dynamic = "force-dynamic";

const FUNNEL = [
  { step: "1", title: "Ask", detail: "After a visit or paid invoice, the customer gets a request by SMS, WhatsApp or email." },
  { step: "2", title: "Rate", detail: "They tap a 1–5 star rating on a branded TAKATAK review page." },
  { step: "3", title: "Route", detail: "Every customer is offered the public Google review link, with a private message box for anything that went wrong." },
  { step: "4", title: "Respond", detail: "New reviews are pulled in, AI drafts replies, the owner approves, and low ratings alert the owner immediately." },
];

const FEATURES = [
  { name: "Review requests", detail: "SMS, WhatsApp and email with one automatic reminder." },
  { name: "Review monitoring", detail: "Google, Facebook, Yelp and Trustpilot in one feed." },
  { name: "AI review replies", detail: "On-brand drafts in French or English, 1 credit each." },
  { name: "Private feedback", detail: "Unhappy customers reach the owner before they post." },
  { name: "Review widgets", detail: "Show the best reviews on the client website." },
  { name: "Reputation report", detail: "Average rating, velocity and response rate per location." },
];

export default async function ReputationPage() {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/reviews");
  const scoped = access.mode === "client_scoped" && hasEffectivePermission(access, "view_reputation");
  const canManage = scoped && hasEffectivePermission(access, "manage_reputation");
  let snapshot: ReputationSnapshot | null = null;
  let unavailable = false;
  if (scoped) {
    try {
      snapshot = await getReputationSnapshot(access.activeClientId);
    } catch {
      unavailable = true;
      console.error("[reputation] snapshot unavailable");
    }
  }
  const connectors = getConnectorStatuses().filter((c) => c.category === "reviews" || c.key === "twilio_sms" || c.key === "whatsapp");

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Reputation & Reviews"
        description="Get more 5-star reviews, catch unhappy customers before they post, and answer every review. This is TAKATAK's Birdeye-style reputation suite."
        badges={[{ label: snapshot ? "Review funnel live" : "Request builder live", tone: "success" }]}
        actions={
          <Link href="/dashboard/local-listings/reviews" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300">
            Tracked reviews →
          </Link>
        }
      />

      {snapshot ? (
        <ReputationWorkspace
          data={snapshot}
          canManage={canManage}
          smsReady={growthSmsConfigured()}
          whatsappReady={growthWhatsAppConfigured()}
          origin={await publicAppOrigin()}
        />
      ) : (
        <HonestyNote>
          {unavailable
            ? "The review database is not reachable right now, so tracked requests and the feedback inbox are hidden. The link builder below still works."
            : "Select a client workspace to manage its review pages, tracked requests and feedback inbox. The link builder below works without one."}
        </HonestyNote>
      )}

      <Card>
        <CardHeader title="Quick link builder" subtitle="No setup needed: build a direct Google review link and send it from your own phone. Use tracked requests above to measure results." />
        <CardBody>
          <ReviewRequestBuilder />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="The review funnel" subtitle="Live today with manual sending. Automatic SMS/WhatsApp delivery turns on with the messaging connectors." />
        <CardBody>
          <ol className="grid gap-3 md:grid-cols-4">
            {FUNNEL.map((f) => (
              <li key={f.step} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{f.step}</span>
                <p className="mt-2 text-sm font-semibold text-slate-900">{f.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{f.detail}</p>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Reputation suite" />
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
        <h2 className="text-sm font-semibold text-slate-900">Review sources & delivery channels</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>
          The private-feedback step never blocks a customer from posting publicly. Google prohibits review gating, so every customer is still
          offered the public link. No review is imported or posted until its source is connected.
        </HonestyNote>
      </section>
    </div>
  );
}
