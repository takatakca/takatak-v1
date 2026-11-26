// Business phone (VoIP) dashboard shell.
// VoIP belongs to MIMT, an independent telecom app. TAKATAK only shows an
// authorized overview. Gate 3 (src/lib/voip/mimt-client.ts) reads the MIMT
// address and access key from the server environment. voip-status.ts still
// reports only not configured or configured and not tested. Assigned numbers
// render only when that check returns them. Every other section stays empty.
// Access is guarded by src/app/dashboard/layout.tsx like the sibling pages.
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Hash,
  History,
  Info,
  PhoneForwarded,
  Voicemail,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { SUPPORT_EMAIL } from "@/lib/website/live-chat-config";
import { probeMimtOverview } from "@/lib/voip/mimt-client";
import { getVoipConnectionStatus } from "@/lib/voip/voip-status";

export const dynamic = "force-dynamic";

const EMPTY_STATE = "No data until MIMT is connected";

const SECTIONS: { title: string; subtitle: string; icon: LucideIcon; planned?: boolean }[] = [
  {
    title: "Phone numbers",
    subtitle: "Business numbers assigned to this workspace by MIMT.",
    icon: Hash,
  },
  {
    title: "Call history",
    subtitle: "Incoming and outgoing calls, as reported by MIMT.",
    icon: History,
  },
  {
    title: "Voicemail",
    subtitle: "Voicemail messages and greetings.",
    icon: Voicemail,
  },
  {
    title: "Call transfers & forwarding",
    subtitle: "Where calls go when you are busy, away or closed.",
    icon: PhoneForwarded,
  },
  {
    title: "Business hours / auto-attendant",
    subtitle: "Opening hours and the menu callers hear.",
    icon: Clock,
    planned: true,
  },
  {
    title: "Usage",
    subtitle: "Call minutes and messages, as reported by MIMT.",
    icon: BarChart3,
  },
];

const OWNER_STEPS = [
  "Choose your business phone plan, or tell the team what you need.",
  "MIMT sets up the phone side: your Canadian number, the CRTC registration and emergency calling.",
  "The TAKATAK team links your MIMT service to this workspace. Your numbers, calls and voicemail then show up here.",
];

const SALES_HREF =
  "mailto:" + SUPPORT_EMAIL + "?subject=" + encodeURIComponent("Business phone (VoIP)");

export default async function VoipOverviewPage() {
  const status = getVoipConnectionStatus();
  const session = await getSessionUser();
  const globalUserId = session && typeof session.id === "string" ? session.id : "";
  const overview = globalUserId ? await probeMimtOverview({ globalUserId }) : null;
  const numbers = overview && overview.connected ? overview.numbers : [];
  const notConfigured = status.state === "not_configured";
  const BannerIcon = notConfigured ? AlertTriangle : Info;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Téléphone d’affaires · Business phone</h1>
            <Badge tone={notConfigured ? "warning" : "neutral"}>{status.label}</Badge>
            <Badge tone="muted">Géré par MIMT · Managed by MIMT</Badge>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            An overview of your business phone service. The phone service itself runs in MIMT, an
            independent telecom app; TAKATAK only shows what MIMT shares with this workspace.
          </p>
        </div>
      </div>

      <section
        aria-label="MIMT connection status"
        className={
          notConfigured
            ? "rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4"
            : "rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4"
        }
      >
        <div className="flex items-start gap-3">
          <BannerIcon
            className={notConfigured ? "mt-0.5 h-4 w-4 shrink-0 text-amber-600" : "mt-0.5 h-4 w-4 shrink-0 text-slate-500"}
            aria-hidden="true"
          />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">{status.label}</p>
            <p className="text-sm text-slate-600">{status.detail}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">La suite · What happens next</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              {OWNER_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-label="Business phone sections" className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title}>
              <CardHeader
                title={s.title}
                subtitle={s.subtitle}
                action={<Badge tone="muted">Aucune donnée · No data</Badge>}
              />
              <CardBody className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {s.title === "Phone numbers" && numbers.length > 0 ? (
                  <ul className="space-y-1 text-sm text-slate-700">
                    {numbers.map((n) => (
                      <li key={n.phone_number_id}>{n.e164}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">{EMPTY_STATE}.</p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader
          title="Get a business phone"
          subtitle="A Canadian business number with calls, voicemail and forwarding, through MIMT. Tell us what you need and the team sets it up."
        />
        <CardBody className="flex flex-wrap gap-2">
          <Button href="/services/voip">Voir les forfaits de téléphone d’affaires · See business phone plans</Button>
          <Button href={SALES_HREF} variant="secondary">Parler aux ventes · Talk to sales</Button>
        </CardBody>
      </Card>
    </div>
  );
}
