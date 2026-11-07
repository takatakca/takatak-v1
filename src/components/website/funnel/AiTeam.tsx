"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, Mail, MapPin, MessageSquareText, PenLine, Sparkles, Star } from "lucide-react";

import { openLiveChat } from "@/lib/website/chat-provider";

import { BRAND_ICONS } from "@/lib/website/brand-icons";
import { engineName } from "@/lib/takbot/copy";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { sectionId } from "./HomeSectionNav";
import { Eyebrow, Rise, Section, TwoTone, useSeen } from "./primitives";
import { RobotMascot } from "./RobotMascot";

type Lang = "fr" | "en";
type Bi = Record<Lang, string>;
type Status = "working" | "done" | "online" | "soon";

const STATUS: Record<Status, { label: Bi; cls: string }> = {
  // Theme-aware status colours (--hp-info / --hp-ok / --hp-warn switch with light and dark).
  working: { label: { fr: "Au travail", en: "Working" }, cls: "bg-[color-mix(in_srgb,var(--hp-info)_14%,transparent)] text-[var(--hp-info)]" },
  done: { label: { fr: "Terminé", en: "Done" }, cls: "bg-[color-mix(in_srgb,var(--hp-ok)_14%,transparent)] text-[var(--hp-ok)]" },
  online: { label: { fr: "En ligne", en: "Online" }, cls: "bg-[color-mix(in_srgb,var(--hp-ok)_14%,transparent)] text-[var(--hp-ok)]" },
  soon: { label: { fr: "Bientôt", en: "Soon" }, cls: "bg-[color-mix(in_srgb,var(--hp-warn)_16%,transparent)] text-[var(--hp-warn)]" },
};

const AGENTS: { key: string; Icon: typeof Sparkles; name: Bi; task: Bi; status: Status }[] = [
  { key: "social", Icon: PenLine, name: { fr: "Agent Réseaux sociaux", en: "Social Media Agent" }, task: { fr: "Rédige vos publications de la semaine", en: "Writing this week's posts" }, status: "working" },
  { key: "local", Icon: MapPin, name: { fr: "Agent Fiches locales", en: "Local Listings Agent" }, task: { fr: "Heures des fêtes ajoutées à votre fiche", en: "Holiday hours added to your listing" }, status: "done" },
  { key: "sales", Icon: MessageSquareText, name: { fr: "Assistant ventes", en: "Sales Assistant" }, task: { fr: "Répond aux visiteurs et prépare les demandes", en: "Answers visitors and prepares requests" }, status: "online" },
  { key: "takbot", Icon: Sparkles, name: { fr: "TAK-TAK", en: "TAK-TAK" }, task: { fr: "Rédige, cherche et répond pour votre équipe", en: "Writes, researches and answers for your team" }, status: "online" },
  { key: "reviews", Icon: Star, name: { fr: "Agent Avis", en: "Reviews Agent" }, task: { fr: "Proposera des réponses aux nouveaux avis", en: "Will draft replies to new reviews" }, status: "soon" },
];

const POSTS: { day: Bi; net: string; text: Bi; state: "scheduled" | "writing" | "queued" }[] = [
  { day: { fr: "Lun · 9 h", en: "Mon · 9 am" }, net: "instagram", text: { fr: "Le menu d'automne est arrivé", en: "The fall menu is here" }, state: "scheduled" },
  { day: { fr: "Mer · 12 h", en: "Wed · 12 pm" }, net: "facebook", text: { fr: "Trois raisons de réserver ce week-end", en: "Three reasons to book this weekend" }, state: "writing" },
  { day: { fr: "Ven · 17 h", en: "Fri · 5 pm" }, net: "tiktok", text: { fr: "En coulisses : la préparation du matin", en: "Behind the scenes: the morning prep" }, state: "queued" },
];

const POST_STATE: Record<(typeof POSTS)[number]["state"], { label: Bi; cls: string }> = {
  scheduled: { label: { fr: "Programmé", en: "Scheduled" }, cls: "bg-emerald-500/12 text-emerald-700" },
  writing: { label: { fr: "En rédaction", en: "Writing" }, cls: "bg-[#1F8BFF]/12 text-[#1565D8]" },
  queued: { label: { fr: "En file", en: "Queued" }, cls: "bg-slate-500/10 text-slate-600" },
};

const T = {
  eyebrow: { fr: "Votre équipe IA", en: "Your AI team" },
  lead: { fr: "Votre équipe IA,", en: "Your AI team," },
  rest: { fr: "au travail 24 h sur 24.", en: "working 24/7." },
  body: {
    fr: "Des agents qui rédigent, publient, tiennent vos fiches à jour et répondent à vos clients, dans votre compte TAKATAK. Une personne de notre équipe reste responsable de votre compte.",
    en: "Agents that write, post, keep your listings up to date and answer your customers, inside your TAKATAK account. A person on our team stays responsible for your account.",
  },
  demo: { fr: "Démonstration", en: "Demo" },
  example: { fr: "Exemple : une semaine type dans votre compte TAKATAK.", en: "Example: a typical week in your TAKATAK account." },
  posts: { fr: "Publications de la semaine", en: "This week's posts" },
  engines: { fr: "Moteurs d'IA branchés en ce moment", en: "AI engines connected right now" },
  try: { fr: "Essayer TAK-TAK gratuitement", en: "Try TAK-TAK for free" },
} as const;

const ENGINE_ICON: Record<string, string> = {
  anthropic: "claude",
  gemini: "googlegemini",
  mistral: "mistralai",
  perplexity: "perplexity",
  deepseek: "deepseek",
};

/** "Your AI team": agents as cards with a live status, the week's posts, and the engines really connected. */
export function AiTeam() {
  const { lang: l } = useLanguage();
  const lang = l as Lang;
  const reduced = useReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [tick, setTick] = useState(0);
  const [engines, setEngines] = useState<{ key: string; name: string }[]>([]);

  useEffect(() => {
    if (reduced || !seen) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1800);
    return () => window.clearInterval(t);
  }, [reduced, seen]);

  // Only the engines that have a working key on the server (no claim without runtime evidence).
  useEffect(() => {
    let alive = true;
    fetch("/api/takbot/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { engines?: { key: string; name: string; connected: boolean; inline: boolean }[] } | null) => {
        if (!alive || !data?.engines) return;
        setEngines(data.engines.filter((e) => e.connected && e.inline).map((e) => ({ key: e.key, name: e.name.replace(/\s*\(.*\)\s*$/, "") })));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const dots = ".".repeat((tick % 3) + 1);
  const writingIdx = reduced ? 1 : tick % POSTS.length;

  return (
    <Section id={sectionId("team")} labelledBy="home-team-title" className="hp-bg hp-live py-16 sm:py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Rise className="relative max-w-3xl">
            <div aria-hidden className="pointer-events-none absolute -top-4 right-0 lg:hidden">
              <RobotMascot size={72} title="TAK-TAK" />
            </div>
            <Eyebrow>{T.eyebrow[lang]}</Eyebrow>
            <TwoTone id="home-team-title" lead={T.lead[lang]} rest={T.rest[lang]} size="md" />
            <p className="hp-ink-2 mt-5 max-w-2xl text-[17px] leading-8">{T.body[lang]}</p>
          </Rise>
          <Rise delay={120} className="hidden justify-self-end lg:block">
            <RobotMascot size={150} title="TAK-TAK" />
          </Rise>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          {/* Agents with their status, as an example week */}
          <div>
          <p className="hp-ink-3 mb-3 text-[12.5px]">{T.example[lang]}</p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {AGENTS.map((a, i) => {
              const s = STATUS[a.status];
              const live = a.status === "working";
              return (
                <Rise as="li" key={a.key} delay={i * 70} className={`hp-build ${i === AGENTS.length - 1 && AGENTS.length % 2 ? "sm:col-span-2" : ""}`}>
                  <div className="hp-card hp-glow flex h-full items-start gap-3 rounded-[22px] p-4 ring-1 ring-[var(--hp-line)]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1F8BFF,#29C3FF)] text-white shadow-[0_10px_24px_-10px_rgb(31_139_255/0.8)]">
                      <a.Icon size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="hp-ink text-[15px] font-semibold leading-snug">{a.name[lang]}</p>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${s.cls}`}>
                          {(live || a.status === "online") && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                          {s.label[lang]}
                        </span>
                      </div>
                      <p className="hp-ink-2 mt-1 text-[14px]">
                        {a.task[lang]}
                        {live && !reduced ? dots : ""}
                      </p>
                    </div>
                  </div>
                </Rise>
              );
            })}
          </ul>
          </div>

          {/* The week's posts, with their state */}
          <Rise delay={140}>
            <div className="hp-glow relative h-full rounded-[26px] bg-[linear-gradient(160deg,#0B1B3D,#060D1F_70%)] p-5 text-white shadow-[0_40px_90px_-40px_rgb(6_13_31/0.8)] sm:p-6">
              <span className="absolute right-4 top-4 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60">{T.demo[lang]}</span>
              <p className="flex items-center gap-2 text-[14px] font-semibold">
                <CalendarClock size={16} aria-hidden /> {T.posts[lang]}
              </p>
              <ul className="mt-4 grid grid-cols-1 gap-2.5">
                {POSTS.map((p, i) => {
                  const icon = BRAND_ICONS[p.net];
                  const state = i === writingIdx ? POST_STATE.writing : POST_STATE[p.state === "writing" ? "queued" : p.state];
                  return (
                    <li key={p.text.fr} className={`flex items-center gap-3 rounded-2xl p-3 transition-colors duration-500 ${i === writingIdx ? "bg-white/[0.1] ring-1 ring-[#29C3FF]/40" : "bg-white/[0.04] ring-1 ring-white/10"}`}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white">
                        {icon && (
                          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill={icon.hex}>
                            <path d={icon.path} />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] text-white/55">{p.day[lang]}</span>
                        <span className="block truncate text-[14px] font-semibold">{p.text[lang]}</span>
                      </span>
                      <span className={`shrink-0 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold ${state.cls}`}>{state.label[lang]}</span>
                    </li>
                  );
                })}
              </ul>
              <a
                href={`#${sectionId("takbot")}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(sectionId("takbot"))?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-[#060D1F] transition-transform hover:scale-[1.02]"
              >
                {T.try[lang]} <ArrowRight size={16} aria-hidden />
              </a>
            </div>
          </Rise>
        </div>

        {/* AIOS: the next agent, one per restaurant (in preparation) */}
        <Rise className="mt-6">
          <div className="hp-glow relative grid grid-cols-1 items-center gap-5 overflow-hidden rounded-[26px] bg-[linear-gradient(120deg,#060D1F,#0B1B3D_55%,#1565D8)] p-5 text-white sm:p-7 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            <div aria-hidden className="hidden lg:block">
              <RobotMascot size={92} title="AIOS" />
            </div>
            <div>
              <p className="flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7FD8FF]">
                {lang === "fr" ? "Nouveau projet" : "New project"}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] tracking-wide text-white/75">{lang === "fr" ? "En préparation" : "In preparation"}</span>
              </p>
              <p className="mt-2 text-[24px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[28px]">
                {lang === "fr" ? "AIOS : un agent IA attitré à chaque restaurant." : "AIOS: one AI agent assigned to each restaurant."}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2 text-[13.5px] text-white/85">
                {(lang === "fr"
                  ? [
                      [Mail, "Courriels et réponses"],
                      [Star, "Avis Google et Facebook"],
                      [MessageSquareText, "Questions des clients"],
                      [Sparkles, "Résumé de la journée Food Hub"],
                    ]
                  : [
                      [Mail, "Email and replies"],
                      [Star, "Google and Facebook reviews"],
                      [MessageSquareText, "Customer questions"],
                      [Sparkles, "Food Hub day summary"],
                    ]
                ).map(([Icon, label]) => {
                  const I = Icon as typeof Mail;
                  return (
                    <li key={label as string} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                      <I size={14} className="text-[#7FD8FF]" aria-hidden /> {label as string}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[13.5px] text-white/60">
                {lang === "fr" ? "Vous approuvez avant chaque envoi. Il dit toujours qu’il est une IA." : "You approve before anything is sent. It always says it is an AI."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openLiveChat({ page: "/", intent: "aios_waitlist", lang })}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[14.5px] font-semibold text-[#060D1F] transition-transform hover:scale-[1.02]"
            >
              {lang === "fr" ? "Réserver AIOS" : "Reserve AIOS"} <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        </Rise>

        {/* Only the engines with a working key on the server */}
        {engines.length > 0 && (
          <div className="mt-8">
            <p className="hp-ink-3 text-[12px] font-semibold uppercase tracking-[0.16em]">{T.engines[lang]}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {engines.map((e) => {
                const icon = ENGINE_ICON[e.key] ? BRAND_ICONS[ENGINE_ICON[e.key]] : null;
                return (
                  <li key={e.key} className="hp-card hp-ink flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[13.5px] font-semibold ring-1 ring-[var(--hp-line)]">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white ring-1 ring-[var(--hp-line)]">
                      {icon ? (
                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill={icon.hex}>
                          <path d={icon.path} />
                        </svg>
                      ) : (
                        <span className="font-mono text-[10px] font-bold text-[#060D1F]">{e.name.slice(0, 2).toUpperCase()}</span>
                      )}
                    </span>
                    {engineName(e.name, lang)}
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}
