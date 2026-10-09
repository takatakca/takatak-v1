// Business phone (VoIP) dashboard shell.
// VoIP belongs to MIMT, an independent telecom app. TAKATAK only shows an
// authorized overview, and this page has no MIMT client yet: every section
// is an honest empty state. No phone numbers, calls or usage are invented.
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
import { SUPPORT_EMAIL } from "@/lib/website/live-chat-config";
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

const QUICK_ACTIONS = [
  { label: "Add a phone number", note: "Coming soon" },
  { label: "Set up call forwarding", note: "Coming soon" },
  { label: "Record a voicemail greeting", note: "Coming soon" },
  { label: "Set business hours", note: "Planned" },
  { label: "Test MIMT connection", note: "Coming soon" },
];

const OWNER_STEPS = [
  "Connect MIMT to this workspace. A TAKATAK administrator adds the MIMT address and access key once your MIMT service is ready.",
  "MIMT handles the phone side: the phone provider account, your Canadian phone number, the CRTC registration and emergency calling setup. None of this is done in TAKATAK.",
  "After a successful connection test, your numbers, calls and voicemail show up here.",
];

const SALES_HREF =
  "mailto:" + SUPPORT_EMAIL + "?subject=" + encodeURIComponent("Business phone (VoIP)");

export default function VoipOverviewPage() {
  const status = getVoipConnectionStatus();
  const notConfigured = status.state === "not_configured";
  const BannerIcon = notConfigured ? AlertTriangle : Info;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Business phone</h1>
            <Badge tone="warning">Foundation</Badge>
            <Badge tone={notConfigured ? "warning" : "neutral"}>{status.label}</Badge>
            <Badge tone="muted">Managed by MIMT</Badge>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What happens next</p>
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
                action={s.planned ? <Badge tone="accent">Planned</Badge> : <Badge tone="muted">No data</Badge>}
              />
              <CardBody className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-sm text-slate-500">{EMPTY_STATE}.</p>
              </CardBody>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader title="Quick Actions" subtitle="Actions activate once MIMT is connected and tested." />
        <CardBody className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <span key={a.label} className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-400 ring-1 ring-inset ring-slate-200">
              {a.label}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{a.note}</span>
            </span>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Get a business phone"
          subtitle="Business phone with MIMT is planned. Join the waitlist or talk to our team about your needs."
        />
        <CardBody className="flex flex-wrap gap-2">
          <Button href="/services/voip">Join the waitlist</Button>
          <Button href={SALES_HREF} variant="secondary">Talk to sales</Button>
        </CardBody>
      </Card>
    </div>
  );
}
