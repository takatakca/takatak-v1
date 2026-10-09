"use client";

// In-code product mock-ups used where no repo image fits. Figures shown inside
// them are sample data for illustration (each frame carries an "Illustration"
// tag); only the prices come from the code catalogs.
import type { ReactNode } from "react";
import {
  ArrowDown,
  Check,
  CircleDot,
  Globe2,
  HardDrive,
  Lock,
  MapPin,
  Phone,
  Plus,
  Search,
  Send,
  Server,
  Sparkles,
  Star,
  Users,
  Voicemail,
} from "lucide-react";

import { pricing } from "@/lib/website/pricing";
import type { MockKind } from "@/lib/website/core-categories";
import { money, SoonTag, useCopy } from "./ui";

function Window({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,#0F2147,#0A1734)] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2">
        <span className="flex gap-1" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/10" />
        </span>
        <span className="truncate font-semibold uppercase tracking-[0.16em] text-white/55 text-[11px]">
          {title}
        </span>
        <span className="ml-auto">{right}</span>
      </div>
      <div className="min-h-0 flex-1 p-4">{children}</div>
    </div>
  );
}

function StatusDot({ tone }: { tone: "ok" | "warn" | "bad" | "muted" }) {
  const c = { ok: "bg-emerald-400", warn: "bg-amber-400", bad: "bg-rose-400", muted: "bg-white/30" }[tone];
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${c}`} />;
}

function Stars({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={11}
          aria-hidden
          className={i <= n ? "fill-[var(--tk-accent,#D946EF)] text-[var(--tk-accent,#D946EF)]" : "text-white/25"}
        />
      ))}
    </span>
  );
}

function DomainSearchMock() {
  const { tk, lang } = useCopy();
  const price = money(lang, pricing.domain.register.amount);
  const rows = [
    { tld: "ca", ok: true },
    { tld: "com", ok: true },
    { tld: "net", ok: true },
    { tld: "org", ok: false },
  ];
  return (
    <Window title="takatak.ca / domain">
      <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-2">
        <Globe2 size={14} className="text-[var(--tk-accent)]" aria-hidden />
        <span className="font-medium text-white text-sm">yourbrand</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-[var(--tk-accent)] px-2 py-1 font-bold text-[#04122B] text-[11px]">
          <Search size={11} aria-hidden /> .ca
        </span>
      </div>
      <ul className="mt-2.5 grid gap-1.5">
        {rows.map((r) => (
          <li
            key={r.tld}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
              r.ok ? "border-white/10 bg-white/[0.04]" : "border-white/5 bg-transparent opacity-55"
            }`}
          >
            <StatusDot tone={r.ok ? "ok" : "muted"} />
            <span className="font-semibold text-white">yourbrand.{r.tld}</span>
            <span className="text-white/50">{r.ok ? tk("mock.available") : tk("mock.taken")}</span>
            {r.ok && (
              <>
                <span className="ml-auto font-semibold text-white/85">
                  {price}
                  <span className="text-white/45">{tk("mock.perYear")}</span>
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
                  <Plus size={10} aria-hidden /> {tk("mock.add")}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </Window>
  );
}

function DnsMock() {
  const { tk } = useCopy();
  const rows = [
    ["A", "@", "192.0.2.10"],
    ["CNAME", "www", "yourbrand.ca"],
    ["MX", "@", "mail.yourbrand.ca"],
    ["TXT", "@", "v=spf1 include:…"],
  ];
  return (
    <Window title={tk("mock.dnsTitle")}>
      <ul className="grid gap-1.5 font-mono text-[11px]">
        {rows.map(([type, host, value]) => (
          <li key={type} className="grid grid-cols-[52px_34px_1fr_auto] items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <span className="font-bold text-[var(--tk-accent)]">{type}</span>
            <span className="text-white/60">{host}</span>
            <span className="truncate text-white/85">{value}</span>
            <span className="inline-flex items-center gap-1 font-sans text-[10px] text-emerald-200">
              <StatusDot tone="ok" /> {tk("mock.active")}
            </span>
          </li>
        ))}
      </ul>
    </Window>
  );
}

function ServerMock() {
  const { tk, lang } = useCopy();
  const silver = pricing.hosting[2];
  return (
    <Window
      title={tk("mock.serverPlan")}
      right={
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
          <StatusDot tone="ok" /> {tk("mock.online")}
        </span>
      }
    >
      <div className="grid h-full grid-cols-[1fr_auto] gap-3">
        <ul className="grid content-start gap-1.5 text-xs">
          {[
            { icon: Lock, label: tk("mock.sslActive") },
            { icon: HardDrive, label: tk("mock.lastBackup") },
            { icon: Server, label: tk("mock.staging") },
          ].map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
              <Icon size={13} className="text-[var(--tk-accent-2)]" aria-hidden />
              <span className="text-white/85">{label}</span>
              <Check size={13} className="ml-auto text-emerald-300" aria-hidden />
            </li>
          ))}
          <li className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <div className="flex justify-between text-white/70">
              <span>{tk("mock.storage")}</span>
              <span>{silver.features[1]}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="tk-accent-bg h-full w-[34%] rounded-full" />
            </div>
          </li>
        </ul>
        <div className="w-28 flex-col justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3 flex">
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">Silver</span>
          <span className="text-lg font-extrabold text-white">{money(lang, silver.amount)}</span>
          <span className="text-[10px] text-white/50">{tk("cadence.monthly")}</span>
        </div>
      </div>
    </Window>
  );
}

function CampaignMock() {
  const { tk, lang } = useCopy();
  const nf = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA");
  const rows = [
    { platform: "Meta Ads", name: lang === "fr" ? "Promo printemps" : "Spring promo", spend: 420, clicks: 1284, ctr: 2.4, bars: [30, 45, 38, 60, 52, 70, 64] },
    { platform: "Google Ads", name: lang === "fr" ? "Recherche · marque" : "Search · brand", spend: 310, clicks: 962, ctr: 5.1, bars: [40, 36, 50, 48, 62, 58, 75] },
  ];
  return (
    <Window title={tk("mock.campaignsTitle")}>
      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.platform} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
            <div className="flex items-center gap-2">
              <CircleDot size={12} className="text-[var(--tk-accent)]" aria-hidden />
              <span className="font-bold text-white text-xs">{r.platform}</span>
              <span className="truncate text-white/50 text-[11px]">{r.name}</span>
              <span className="ml-auto flex h-5 items-end gap-0.5" aria-hidden>
                {r.bars.map((b, i) => (
                  <span key={i} className="tk-accent-bg w-1 rounded-sm opacity-80" style={{ height: `${b}%` }} />
                ))}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              {[
                [tk("mock.spend"), money(lang, r.spend)],
                [tk("mock.clicks"), nf.format(r.clicks)],
                [tk("mock.ctr"), `${nf.format(r.ctr)}${lang === "fr" ? "\u00a0%" : "%"}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-white/45">{k}</p>
                  <p className="font-bold text-white">{v}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Window>
  );
}

function SocialCalendarMock() {
  const { tk } = useCopy();
  const days = [
    { d: "mock.mon", posts: [{ net: "Instagram", title: "mock.post.reel", ok: true }] },
    { d: "mock.tue", posts: [{ net: "Facebook", title: "mock.post.launch", ok: true }, { net: "Threads", title: "mock.post.tip", ok: true }] },
    { d: "mock.wed", posts: [{ net: "TikTok", title: "mock.post.reel", ok: false }] },
    { d: "mock.thu", posts: [{ net: "YouTube", title: "mock.post.live", ok: true }, { net: "X", title: "mock.post.tip", ok: false }] },
    { d: "mock.fri", posts: [{ net: "Bluesky", title: "mock.post.review", ok: true }] },
  ];
  return (
    <Window title={tk("mock.week")}>
      <div className="grid h-full grid-cols-5 gap-1.5">
        {days.map((day) => (
          <div key={day.d} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-1.5">
            <span className="font-semibold uppercase tracking-[0.14em] text-white/45 text-[10px]">{tk(day.d)}</span>
            {day.posts.map((p, i) => (
              <div key={i} className="rounded-md border border-white/10 bg-[color-mix(in_oklab,var(--tk-accent)_14%,transparent)] p-1.5">
                <p className="truncate font-bold text-white text-[10px]">{p.net}</p>
                <p className="truncate text-[9px] text-white/60 block">{tk(p.title)}</p>
                <p className={`mt-1 inline-flex items-center gap-1 text-[9px] ${p.ok ? "text-emerald-200" : "text-amber-200"}`}>
                  <StatusDot tone={p.ok ? "ok" : "warn"} />
                  <span className="inline">{p.ok ? tk("mock.approved") : tk("mock.toApprove")}</span>
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Window>
  );
}

function ListingMock() {
  const { tk, lang } = useCopy();
  const nf = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA");
  const stats = [
    ["mock.mapsViews", 1240],
    ["mock.calls", 86],
    ["mock.directions", 142],
    ["mock.websiteClicks", 310],
  ] as const;
  return (
    <Window title="Google Business Profile">
      <div className="grid h-full grid-cols-[0.9fr_1.1fr] gap-2.5">
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0B1E44]">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(115deg, transparent 46%, rgb(255 255 255 / 0.12) 47%, rgb(255 255 255 / 0.12) 50%, transparent 51%), linear-gradient(25deg, transparent 60%, rgb(255 255 255 / 0.09) 61%, rgb(255 255 255 / 0.09) 63%, transparent 64%), linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px)",
              backgroundSize: "100% 100%, 100% 100%, 18px 18px, 18px 18px",
            }}
          />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
            <span aria-hidden className="tk-accent-glow absolute -inset-4 rounded-full" />
            <MapPin size={26} className="relative fill-[var(--tk-accent)] text-white drop-shadow" aria-hidden />
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
            <p className="truncate font-bold text-white text-sm">{tk("mock.bizName")}</p>
            <p className="truncate text-white/55 text-[11px]">{tk("mock.bizCategory")}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-200">
              <StatusDot tone="ok" /> {tk("mock.openNow")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
                <p className="truncate text-white/50 text-[10px]">{tk(k)}</p>
                <p className="font-bold text-white text-sm">{nf.format(v)}</p>
              </div>
            ))}
          </div>
          <p className="items-center gap-1.5 text-[10px] text-white/70 flex">
            <Check size={12} className="text-emerald-300" aria-hidden /> {tk("mock.nap")}
          </p>
        </div>
      </div>
    </Window>
  );
}

function ReviewsMock() {
  const { tk } = useCopy();
  const reviews = [
    { who: "Sophie L.", n: 5, text: "mock.review1", replied: true },
    { who: "Marc D.", n: 4, text: "mock.review2", replied: false },
    { who: "Amina K.", n: 5, text: "mock.review3", replied: true },
  ];
  return (
    <Window title={tk("mock.reviewsTitle")}>
      <ul className="grid gap-1.5">
        {reviews.map((r) => (
          <li key={r.who} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2">
            <span aria-hidden className="tk-accent-bg grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white">
              {r.who.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-white">{r.who}</span>
                <Stars n={r.n} />
              </div>
              <p className="truncate text-white/65 text-[11px]">{tk(r.text)}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                r.replied ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"
              }`}
            >
              {r.replied ? tk("mock.replied") : tk("mock.needsReply")}
            </span>
          </li>
        ))}
      </ul>
    </Window>
  );
}

function ReviewRequestMock() {
  const { tk } = useCopy();
  return (
    <div className="flex h-full items-center justify-center gap-4">
      <div className="relative h-full max-h-[270px] w-[46%] max-w-[170px] rounded-[26px] border border-white/15 bg-[#081430] p-2 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15" />
        <div className="flex h-[calc(100%-12px)] flex-col justify-end gap-2 rounded-[18px] bg-[linear-gradient(180deg,#0E2552,#0A1A3C)] p-2">
          <div className="rounded-xl rounded-bl-sm bg-white/10 p-2 leading-snug text-white/85 text-[10px]">
            {tk("mock.requestMsg")}
          </div>
          <span className="tk-accent-bg inline-flex items-center justify-center gap-1 rounded-lg py-1.5 font-bold text-white text-[10px]">
            <Star size={10} className="fill-white" aria-hidden /> {tk("mock.requestCta")}
          </span>
        </div>
      </div>
      <div className="max-w-[45%] flex-col gap-2 flex">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">{tk("mock.requestTitle")}</p>
        <Stars n={5} className="scale-125 origin-left" />
        <SoonTag className="self-start" />
      </div>
      <SoonTag className="absolute right-3 top-3 hidden" />
    </div>
  );
}

function AiGenerateMock() {
  const { tk } = useCopy();
  return (
    <Window title="AI Studio" right={<SoonTag />}>
      <div className="grid h-full grid-cols-[0.85fr_1.15fr] gap-2.5">
        <div className="flex flex-col gap-1.5">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
            <p className="uppercase tracking-[0.16em] text-white/45 text-[10px]">{tk("mock.brandVoice")}</p>
            <p className="mt-0.5 font-semibold text-white text-[11px]">{tk("mock.voiceTraits")}</p>
          </div>
          <div className="rounded-lg border border-[color-mix(in_oklab,var(--tk-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--tk-accent)_12%,transparent)] p-2">
            <p className="uppercase tracking-[0.16em] text-white/45 text-[10px]">{tk("mock.brief")}</p>
            <p className="mt-0.5 text-white text-[11px]">{tk("mock.briefText")}</p>
          </div>
          <span className="tk-accent-bg mt-auto inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold text-white">
            <Sparkles size={11} aria-hidden /> AI
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 text-[11px]">
          {[
            ["mock.caption", tk("mock.captionText")],
            ["mock.hashtags", "#brunch #montreal #weekend"],
            ["mock.hook", tk("mock.hookText")],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
              <p className="uppercase tracking-[0.16em] text-[var(--tk-accent-2)] text-[10px]">{tk(k)}</p>
              <p className="mt-0.5 line-clamp-2 text-white/85">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </Window>
  );
}

function InvoiceMock() {
  const { tk, lang } = useCopy();
  const lines = [
    { label: tk("mock.line1"), amount: 250 },
    { label: tk("mock.line2"), amount: pricing.hosting[2].amount },
  ];
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  const qst = Math.round(subtotal * 0.09975 * 100) / 100;
  const total = subtotal + gst + qst;
  const m = (n: number) =>
    new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
    }).format(n);
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex h-full w-full max-w-[420px] flex-col rounded-xl bg-[#F5F8FC] text-[#0B1B3D] shadow-[0_30px_60px_-28px_rgb(0_0_0/0.9)] p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1565D8]">{tk("mock.invoice")}</p>
            <p className="font-extrabold text-base">#1042</p>
          </div>
          <div className="text-right text-[#4A5A75] text-[10px]">
            <p>{tk("mock.billTo")}</p>
            <p className="font-semibold text-[#0B1B3D]">{tk("mock.clientName")}</p>
          </div>
        </div>
        <ul className="mt-2 grid gap-1 border-y border-[#0B1B3D]/10 py-1.5 text-[11px]">
          {lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-2">
              <span className="truncate">{l.label}</span>
              <span className="font-semibold tabular-nums">{m(l.amount)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-1.5 grid gap-0.5 text-[#4A5A75] text-[11px]">
          {[
            [tk("mock.subtotal"), subtotal],
            [tk("mock.gst"), gst],
            [tk("mock.qst"), qst],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between">
              <dt>{k}</dt>
              <dd className="tabular-nums">{m(v as number)}</dd>
            </div>
          ))}
          <div className="mt-0.5 flex justify-between border-t border-[#0B1B3D]/10 pt-1 font-extrabold text-[#0B1B3D] text-sm">
            <dt>{tk("mock.total")}</dt>
            <dd className="tabular-nums">{m(total)}</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-[#4A5A75] text-[10px]">{tk("mock.dueIn")}</span>
          <span className="rounded-md bg-[#1565D8] px-2.5 py-1 font-bold text-white text-[11px]">{tk("mock.payOnline")}</span>
        </div>
      </div>
    </div>
  );
}

function InvoiceListMock() {
  const { tk, lang } = useCopy();
  const rows = [
    { n: "#1042", who: "Client Inc.", amount: 333.42, tone: "ok" as const, label: "mock.paid" },
    { n: "#1041", who: "Studio Nord", amount: 1499, tone: "warn" as const, label: "mock.open" },
    { n: "#1039", who: "Café Laurier", amount: 289.99, tone: "bad" as const, label: "mock.overdue" },
  ];
  const chip = { ok: "bg-emerald-400/15 text-emerald-200", warn: "bg-amber-400/15 text-amber-200", bad: "bg-rose-400/15 text-rose-200" };
  return (
    <Window title={tk("mock.invoice")}>
      <div className="mb-2 flex gap-1 text-[10px]">
        {["mock.paid", "mock.open", "mock.overdue"].map((k, i) => (
          <span key={k} className={`rounded-full border px-2 py-0.5 ${i === 0 ? "border-[var(--tk-accent)] text-white" : "border-white/12 text-white/55"}`}>
            {tk(k)}
          </span>
        ))}
      </div>
      <ul className="grid gap-1.5">
        {rows.map((r) => (
          <li key={r.n} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[11px]">
            <span className="font-mono font-semibold text-white/80">{r.n}</span>
            <span className="truncate text-white/60">{r.who}</span>
            <span className="ml-auto font-semibold tabular-nums text-white">{money(lang, r.amount)}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${chip[r.tone]}`}>{tk(r.label)}</span>
          </li>
        ))}
      </ul>
      <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] font-semibold text-white/80">
        <Send size={10} aria-hidden /> {tk("mock.remind")}
      </span>
    </Window>
  );
}

function CallFlowMock() {
  const { tk } = useCopy();
  const node = "rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1.5 text-center font-semibold text-white text-[11px]";
  return (
    <Window title={tk("mock.attendant")} right={<SoonTag />}>
      <div className="flex h-full flex-col items-center justify-between gap-1">
        <div className={`${node} inline-flex items-center gap-1.5`}>
          <Phone size={11} className="text-[var(--tk-accent)]" aria-hidden /> {tk("mock.incoming")}
        </div>
        <ArrowDown size={12} className="text-white/35" aria-hidden />
        <div className="tk-accent-ring rounded-xl bg-[color-mix(in_oklab,var(--tk-accent)_14%,transparent)] px-3 py-1.5 text-center">
          <p className="font-bold text-white text-[11px]">{tk("mock.attendant")}</p>
          <p className="text-white/65 text-[10px]">
            {tk("mock.press1")} · {tk("mock.press2")}
          </p>
        </div>
        <ArrowDown size={12} className="text-white/35" aria-hidden />
        <div className="grid w-full grid-cols-3 gap-1.5">
          <div className={node}>
            <Users size={11} className="mx-auto mb-0.5 text-[var(--tk-accent-2)]" aria-hidden />
            {tk("mock.ext")} 101 · {tk("mock.sales")}
          </div>
          <div className={node}>
            <Users size={11} className="mx-auto mb-0.5 text-[var(--tk-accent-2)]" aria-hidden />
            {tk("mock.ext")} 102 · {tk("mock.support")}
          </div>
          <div className={node}>
            <Voicemail size={11} className="mx-auto mb-0.5 text-[var(--tk-accent-2)]" aria-hidden />
            {tk("mock.voicemail")}
          </div>
        </div>
      </div>
    </Window>
  );
}

const MOCKS: Record<MockKind, () => ReactNode> = {
  domainSearch: DomainSearchMock,
  dns: DnsMock,
  server: ServerMock,
  campaign: CampaignMock,
  socialCalendar: SocialCalendarMock,
  listing: ListingMock,
  reviews: ReviewsMock,
  reviewRequest: ReviewRequestMock,
  aiGenerate: AiGenerateMock,
  invoice: InvoiceMock,
  invoiceList: InvoiceListMock,
  callFlow: CallFlowMock,
};

export function Mock({ kind }: { kind: MockKind }) {
  const Component = MOCKS[kind];
  return <Component />;
}

/** Compact floating notification card used to layer depth over visuals. */
export function FloatCard({
  icon,
  title,
  subtitle,
  tone = "accent",
  className = "",
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  tone?: "accent" | "ok";
  className?: string;
}) {
  return (
    <div className={`tk-glass-solid flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ${className}`}>
      <span
        aria-hidden
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
          tone === "ok" ? "bg-emerald-400/15 text-emerald-200" : "tk-accent-bg text-white"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-white">{title}</span>
        {subtitle && <span className="block truncate text-[11px] text-white/60">{subtitle}</span>}
      </span>
    </div>
  );
}
