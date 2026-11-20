"use client";

// Owner (Nov 20 2026): the top of the homepage is TAK-TAK itself, a full chat
// workspace in the spirit of ChatGPT or Claude, in the TAKATAK navy and
// electric blue. No left-hand marketing text. The answers come from the real
// catalog (real prices), services go into the visitor's plan, and the chat
// ends on a request or an order.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  Check,
  ClipboardList,
  Globe,
  Headset,
  LayoutTemplate,
  Mail,
  MapPin,
  Megaphone,
  MessageSquarePlus,
  PenTool,
  Phone,
  Receipt,
  Server,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { HERO_CHIPS } from "@/lib/website/concierge";
import { CORE_CATEGORIES, type CategoryKey } from "@/lib/website/core-categories";
import { fill } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { nextSuggestions } from "@/lib/website/home-upsell";
import { Link } from "@/lib/website/nav";
import { PROMO_CODE, PROMO_PERCENT } from "@/lib/website/promotions";
import { FICHE_LABELS, FICHE_ORDER } from "@/lib/website/sales-fiche";
import { C, Concierge, MicButton, ServiceRow, useConversation, useDictation, type Msg } from "./AskBar";
import { CampaignCountdown, useActiveCampaign } from "./Campaign";
import { sectionId } from "./HomeSectionNav";
import { CONCIERGE_OPEN_EVENT } from "./OfferRail";
import { RobotMascot } from "./RobotMascot";
import { prefillTakbot } from "./TakbotTryPanel";

type Lang = "en" | "fr";

const H = {
  title: { fr: "Qu’est-ce qu’on fait pour votre entreprise ?", en: "What can we do for your business?" },
  sub: {
    fr: "Site web, domaine, hébergement, Google, réseaux sociaux, facturation : demandez, TAK-TAK vous montre les bons services avec les vrais prix.",
    en: "Website, domain, hosting, Google, social media, invoicing: ask, and TAK-TAK shows you the right services with real prices.",
  },
  online: { fr: "En ligne · français et anglais", en: "Online · French and English" },
  newChat: { fr: "Nouvelle conversation", en: "New conversation" },
  services: { fr: "Services", en: "Services" },
  plan: { fr: "Votre sélection", en: "Your selection" },
  planEmpty: { fr: "Ajoutez des services pendant la conversation.", en: "Add services during the conversation." },
  finalize: { fr: "Finaliser ma commande", en: "Finalize my order" },
  offer: { fr: "{p} % sur votre premier service", en: "{p}% off your first service" },
  offerCode: { fr: "Code {code} · appliqué au paiement", en: "Code {code} · applied at checkout" },
  placeholder: { fr: "Écrivez à TAK-TAK…", en: "Message TAK-TAK…" },
  note: {
    fr: "Réponses tirées de notre catalogue, avec les vrais prix. Rien n’est facturé sans votre accord.",
    en: "Answers from our catalog, with real prices. Nothing is charged without your approval.",
  },
  ask: { fr: "Demander à TAK-TAK : {q}", en: "Ask TAK-TAK: {q}" },
  order: { fr: "Commander", en: "Checkout" },
  pairs: { fr: "{a} est dans votre sélection. Ça va bien avec :", en: "{a} is in your selection. It pairs well with:" },
} as const;

const CHIP_ICON: Record<string, LucideIcon> = {
  domains: Globe,
  website: LayoutTemplate,
  hosting: Server,
  leads: MapPin,
  logo: PenTool,
  marketing: Megaphone,
};

const CATEGORY_ICON: Record<CategoryKey, LucideIcon> = {
  website: LayoutTemplate,
  domains: Globe,
  hosting: Server,
  marketing: Megaphone,
  social: Share2,
  local: MapPin,
  reviews: Star,
  ai: Sparkles,
  billing: Receipt,
  voip: Phone,
};

function TypingDots({ label }: { label: string }) {
  return (
    <span className="inline-flex h-10 items-center gap-1.5 rounded-2xl rounded-tl-md bg-white/[0.07] px-4 ring-1 ring-white/10" aria-label={label}>
      <span className="tk-typing-dot" />
      <span className="tk-typing-dot [animation-delay:0.15s]" />
      <span className="tk-typing-dot [animation-delay:0.3s]" />
    </span>
  );
}

function BotAvatar() {
  return (
    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#060D1F] ring-1 ring-white/15">
      <RobotMascot headOnly size={24} wave={false} title="TAK-TAK" />
    </span>
  );
}

/** Left rail: new chat, the services you can ask about, your selection, the real welcome offer. */
function Rail({ lang, tk, onAsk, onNew }: { lang: Lang; tk: (key: string) => string; onAsk: (q: string) => void; onNew: () => void }) {
  const plan = useHomePlan();
  return (
    <aside className="hidden min-h-0 flex-col border-r border-white/10 bg-white/[0.025] lg:flex" aria-label={H.services[lang]}>
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#060D1F] ring-1 ring-white/15">
          <RobotMascot headOnly size={30} wave={false} title="TAK-TAK" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-white">TAK-TAK</span>
          <span className="block truncate text-[12.5px] text-white/55">{C.role[lang]}</span>
        </span>
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="hp-focus flex w-full items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2.5 text-[13.5px] font-semibold text-white/90 transition-colors hover:border-[var(--tk-cyan)]/50 hover:bg-white/[0.09]"
        >
          <MessageSquarePlus size={16} className="text-[var(--tk-cyan)]" aria-hidden /> {H.newChat[lang]}
        </button>
      </div>

      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-3" aria-label={H.services[lang]}>
        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{H.services[lang]}</p>
        <ul className="grid gap-0.5">
          {CORE_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c.key];
            const name = tk(`cat.${c.key}.name`);
            const price =
              typeof c.from === "string"
                ? tk(c.from === "quote" ? "cat.onQuote" : "cat.planned")
                : `${money(lang, c.from.amount)}${cadenceSuffix(tk, c.from.cadence)}`;
            return (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => onAsk(name)}
                  className="hp-focus group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.07]"
                >
                  <Icon size={15} className="shrink-0 text-white/55 group-hover:text-[var(--tk-cyan)]" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] leading-5 text-white/85">{name}</span>
                    <span className="block truncate text-[11.5px] leading-4 text-white/45">{price}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{H.plan[lang]}</p>
        {plan.keys.length === 0 ? (
          <p className="px-2 text-[12.5px] leading-5 text-white/45">{H.planEmpty[lang]}</p>
        ) : (
          <ul className="grid gap-1 px-2">
            {plan.keys.map((k) => (
              <li key={k} className="flex items-center gap-2 text-[13px] text-white/85">
                <Check size={13} className="shrink-0 text-[var(--tk-cyan)]" aria-hidden /> <span className="truncate">{tk(`cat.${k}.name`)}</span>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="grid gap-2 border-t border-white/10 p-3">
        {plan.keys.length > 0 && (
          <Link to="/commander" className="hp-cta hp-focus inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold">
            {H.finalize[lang]} <ArrowRight size={15} aria-hidden />
          </Link>
        )}
        <div className="rounded-xl border border-dashed border-[var(--tk-cyan)]/40 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-white">{fill(H.offer[lang], { p: PROMO_PERCENT })}</p>
          <p className="text-[11.5px] text-white/55">{fill(H.offerCode[lang], { code: PROMO_CODE })}</p>
        </div>
      </div>
    </aside>
  );
}

/** One message with what it brings: services with real prices, links, the offer, next steps. */
function Message({
  m,
  lang,
  tk,
  onPrepare,
  onStudio,
  step,
}: {
  m: Msg;
  lang: Lang;
  tk: (key: string) => string;
  onPrepare: () => void;
  /** Hands the visitor's question to the live TAK-TAK studio further down the page. */
  onStudio?: () => void;
  step: unknown;
}) {
  const campaign = useActiveCampaign();
  if (m.from === "me") {
    return (
      <li className="tk-stagger flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-[var(--hp-cta)] px-4 py-2.5 text-[15px] leading-6 text-white">{m.text}</p>
      </li>
    );
  }
  return (
    <li className="tk-stagger flex gap-3">
      <BotAvatar />
      <div className="grid min-w-0 flex-1 gap-2.5">
        <p className="max-w-[92%] whitespace-pre-wrap text-[15px] leading-7 text-white/90">{m.text}</p>
        {m.reply?.services.length ? (
          <div className="grid max-w-xl gap-2">
            {m.reply.services.map((k) => (
              <ServiceRow key={k} k={k} lang={lang} tk={tk} />
            ))}
          </div>
        ) : null}
        {m.reply?.links?.map((l) => (
          <Link key={l.to} to={l.to} className="hp-cta hp-focus inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold">
            {l.label[lang]} <ArrowRight size={15} aria-hidden />
          </Link>
        ))}
        {m.reply?.actions.includes("offer_welcome") && (
          <div className="max-w-xl rounded-2xl border border-dashed border-[var(--hp-cta)] p-3.5">
            <p className="text-[14px] text-white/90">{fill(C.welcome[lang], { p: PROMO_PERCENT, code: PROMO_CODE })}</p>
            {campaign && <CampaignCountdown campaign={campaign} lang={lang} className="mt-2.5" />}
          </div>
        )}
        {m.mail && (
          <a href={m.mail} className="hp-cta hp-focus inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold">
            <Mail size={15} aria-hidden /> {C.mailIt[lang]}
          </a>
        )}
        {m.reply?.actions.includes("support") && (
          <button
            type="button"
            onClick={() => openLiveChat({ page: "/", intent: "support", lang })}
            className="hp-ghost hp-focus inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold"
          >
            <Headset size={15} aria-hidden /> {C.support[lang]}
          </button>
        )}
        {m.reply && onStudio && !m.reply.actions.includes("support") && (
          <button
            type="button"
            onClick={onStudio}
            className="hp-ghost hp-focus inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
          >
            <Sparkles size={14} aria-hidden /> {C.askTakbot[lang]}
          </button>
        )}
        {m.reply && (m.reply.actions.includes("finalize") || m.reply.actions.includes("human")) && (
          <div className="flex flex-wrap gap-2">
            {m.reply.actions.includes("finalize") && !step && (
              <button type="button" onClick={onPrepare} className="hp-ghost hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold">
                <ClipboardList size={15} aria-hidden /> {C.prepare[lang]}
              </button>
            )}
            {m.reply.actions.includes("finalize") && (
              <Link to="/commander" className="hp-cta hp-halo hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold">
                {C.finalize[lang]} <ArrowRight size={15} aria-hidden />
              </Link>
            )}
            <button
              type="button"
              onClick={() => openLiveChat({ page: "/", intent: "concierge_handoff", lang })}
              className="hp-ghost hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold"
            >
              <Headset size={15} aria-hidden /> {C.human[lang]}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The homepage hero: a full TAK-TAK chat workspace. Left rail on large
 * screens, the conversation in the middle, the composer at the bottom.
 * Other homepage sections still open TAK-TAK in a side sheet
 * (CONCIERGE_OPEN_EVENT), so the visitor never loses their place.
 */
export function HeroChat() {
  const { tk, lang } = useCopy();
  const convo = useConversation(lang, tk, { greet: false });
  const { msgs, typing, step, fiche } = convo;
  const plan = useHomePlan();
  const [draft, setDraft] = useState("");
  const [speak, setSpeak] = useState(false);
  const dict = useDictation(lang, setDraft);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const started = msgs.length > 0 || typing;
  // The live TAK-TAK studio is a section further down the homepage.
  const [hasStudio, setHasStudio] = useState(false);
  useEffect(() => setHasStudio(Boolean(document.getElementById(sectionId("takbot")))), []);

  const ask = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setDraft("");
      convo.send(text);
      input.current?.focus({ preventScroll: true });
    },
    [convo],
  );

  // The chat fills the screen below the site header, whatever the header's height.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => el.style.setProperty("--hero-top", `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  // While the chat is on screen, the floating "talk to a person" bubble steps aside:
  // TAK-TAK hands over to a person itself when asked.
  useEffect(() => {
    const el = frame.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) root.setAttribute("data-hero-chat", "");
      else root.removeAttribute("data-hero-chat");
    }, { threshold: 0.35 });
    io.observe(el);
    return () => {
      io.disconnect();
      root.removeAttribute("data-hero-chat");
    };
  }, []);


  // With voice replies on, a finished dictation is sent like a spoken question.
  const wasListening = useRef(false);
  useEffect(() => {
    if (dict.state === "listening") wasListening.current = true;
    else if (wasListening.current && dict.state === "idle") {
      wasListening.current = false;
      if (speak && draft.trim()) ask(draft);
    }
  }, [dict.state, speak, draft, ask]);
  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // Grow the composer with the text, up to five lines.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  // Voice replies: TAK-TAK reads its answers aloud when the visitor turns it on.
  useEffect(() => {
    if (!speak || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const last = msgs[msgs.length - 1];
    if (!last || last.from !== "bot") return;
    const u = new SpeechSynthesisUtterance(last.text);
    u.lang = lang === "fr" ? "fr-CA" : "en-CA";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [msgs, speak, lang]);

  // After a service is added, TAK-TAK suggests the one that pairs with it, inside the conversation.
  const prevKeys = useRef<readonly CategoryKey[] | null>(null);
  const [pair, setPair] = useState<{ added: CategoryKey; next: CategoryKey } | null>(null);
  useEffect(() => {
    const before = prevKeys.current;
    prevKeys.current = plan.keys;
    if (!before) return;
    const fresh = plan.keys.filter((k) => !before.includes(k));
    if (fresh.length !== 1) return;
    const next = nextSuggestions(plan.keys, fresh[0], 1)[0];
    setPair(next ? { added: fresh[0], next } : null);
  }, [plan.keys]);

  // Keep the newest message in view inside the chat (never scrolls the page).
  // Before the first message the welcome screen stays at its top.
  useEffect(() => {
    const el = scroller.current;
    if (el && started) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, step, pair, started]);

  // Other homepage sections open TAK-TAK in the side sheet.
  const [sheet, setSheet] = useState<{ first: string; voice: boolean } | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ first?: string; voice?: boolean }>).detail ?? {};
      setSheet({ first: typeof d.first === "string" ? d.first.slice(0, 300) : "", voice: Boolean(d.voice) });
    };
    window.addEventListener(CONCIERGE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONCIERGE_OPEN_EVENT, onOpen);
  }, []);

  const newChat = () => {
    convo.reset();
    setPair(null);
    setDraft("");
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  return (
    <div ref={frame} className="hp relative" data-theme="dark" data-hero style={{ background: "transparent" }}>
      <div aria-hidden className="pointer-events-none absolute -inset-6 rounded-[48px] bg-[radial-gradient(closest-side,rgb(31_139_255/0.22),transparent)] blur-2xl" />
      <div className="tk-hero-ring relative rounded-[28px] p-px">
        <span aria-hidden className="tk-hero-ring-layer" />
        <div className="relative grid h-[calc(100svh-var(--hero-top,190px)-12px)] max-h-[880px] min-h-[420px] grid-cols-1 overflow-hidden rounded-[27px] bg-[#071330]/[0.93] backdrop-blur-xl sm:h-[calc(100svh-var(--hero-top,136px)-20px)] sm:min-h-[560px] lg:min-h-[600px] lg:grid-cols-[264px_minmax(0,1fr)]">
          <Rail lang={lang} tk={tk} onAsk={ask} onNew={newChat} />

          <div className="flex min-h-0 flex-col">
            {/* Top bar */}
            <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
              <span className="lg:hidden">
                <BotAvatar />
              </span>
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="block whitespace-nowrap text-[15px] font-semibold text-white lg:hidden">TAK-TAK</span>
                <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-white/60">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153/0.8)]" />
                  <span className="truncate">{H.online[lang]}</span>
                </span>
              </span>
              {plan.keys.length > 0 && (
                <Link
                  to="/commander"
                  aria-label={H.finalize[lang]}
                  className="hp-cta hp-focus inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold lg:hidden"
                >
                  <ShoppingBag size={15} aria-hidden /> {plan.keys.length}
                  <span className="hidden sm:inline">· {H.order[lang]}</span> <ArrowRight size={14} aria-hidden />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setSpeak((v) => !v)}
                aria-pressed={speak}
                aria-label={speak ? C.voiceOn[lang] : C.voiceOff[lang]}
                title={speak ? C.voiceOn[lang] : C.voiceOff[lang]}
                className={`hp-focus grid h-9 w-9 place-items-center rounded-full ${speak ? "hp-cta" : "hp-ghost"}`}
              >
                {speak ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
              </button>
              <button
                type="button"
                onClick={newChat}
                aria-label={H.newChat[lang]}
                title={H.newChat[lang]}
                className="hp-ghost hp-focus grid h-9 w-9 place-items-center rounded-full lg:hidden"
              >
                <MessageSquarePlus size={16} aria-hidden />
              </button>
            </header>

            {/* Conversation */}
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8">
                <div className={started ? "" : "my-auto"}>
                  <div className={started ? "sr-only" : "text-center"}>
                    {!started && (
                      <div className="mx-auto mb-4 hidden w-fit sm:block">
                        <RobotMascot size={96} title="TAK-TAK" />
                      </div>
                    )}
                    <h1 id="home-hero-title" className="tk-gradient-text text-balance text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
                      {H.title[lang]}
                    </h1>
                    <p className="mx-auto mt-3 hidden max-w-2xl text-[16px] leading-6 text-white/65 sm:block">{H.sub[lang]}</p>
                  </div>

                  {!started && (
                    <ul className="mt-5 grid grid-cols-2 gap-2 sm:mt-7 sm:gap-2.5 lg:grid-cols-3" aria-label={C.starts[lang]}>
                      {HERO_CHIPS.map((c) => {
                        const Icon = CHIP_ICON[c.key] ?? Sparkles;
                        return (
                          <li key={c.key}>
                            <button
                              type="button"
                              onClick={() => ask(c.ask[lang])}
                              className="hp-focus group flex h-full w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.045] p-2.5 text-left sm:items-start sm:gap-3 sm:p-3.5 transition-all hover:-translate-y-0.5 hover:border-[var(--tk-cyan)]/50 hover:bg-white/[0.08]"
                            >
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--hp-cta)]/15 sm:h-9 sm:w-9 text-[var(--tk-cyan)] ring-1 ring-[var(--tk-cyan)]/25">
                                <Icon size={17} aria-hidden />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[13.5px] font-semibold leading-5 text-white sm:text-[14.5px]">{c.label[lang]}</span>
                                <span className="mt-0.5 hidden text-[13px] leading-5 text-white/55 sm:block">{c.ask[lang]}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {started && (
                  <ol className="grid gap-6">
                    {msgs.map((m, i) => {
                      const asked = msgs[i - 1]?.from === "me" ? msgs[i - 1].text : "";
                      return (
                        <Message
                          key={i}
                          m={m}
                          lang={lang}
                          tk={tk}
                          onPrepare={convo.startFiche}
                          onStudio={hasStudio && asked ? () => prefillTakbot(asked, "chat") : undefined}
                          step={step}
                        />
                      );
                    })}
                    {pair && !plan.has(pair.next) && (
                      <li className="tk-fade-in flex gap-3">
                        <BotAvatar />
                        <div className="grid min-w-0 max-w-xl flex-1 gap-2">
                          <p className="text-[14.5px] leading-6 text-white/80">{fill(H.pairs[lang], { a: tk(`cat.${pair.added}.name`) })}</p>
                          <ServiceRow k={pair.next} lang={lang} tk={tk} />
                        </div>
                      </li>
                    )}
                    {typing && (
                      <li className="flex gap-3">
                        <BotAvatar />
                        <TypingDots label={C.typing[lang]} />
                      </li>
                    )}
                  </ol>
                )}

                {step && step !== "done" && (
                  <div className="tk-fade-in mt-6 rounded-2xl border border-white/12 bg-white/[0.05] p-4" aria-live="polite">
                    <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      <ClipboardList size={13} aria-hidden /> {C.fiche[lang]}
                    </p>
                    <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[14px]">
                      {FICHE_ORDER.map((f) => (
                        <div key={f} className="contents">
                          <dt className="text-white/55">{FICHE_LABELS[f][lang]}</dt>
                          <dd className="truncate font-semibold text-white">{fiche[f] || (step === f ? <span className="hp-caret" aria-hidden /> : "—")}</dd>
                        </div>
                      ))}
                    </dl>
                    {step === "confirm" && (
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => void convo.submitFiche()} className="hp-cta hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold">
                          <Check size={14} aria-hidden /> {C.yes[lang]}
                        </button>
                        <button type="button" onClick={convo.correctFiche} className="hp-ghost hp-focus rounded-full px-4 py-2 text-[13.5px] font-semibold">
                          {C.fix[lang]}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-white/10 px-3 pb-3 pt-2.5 sm:px-6 sm:pb-4">
              <div className="mx-auto w-full max-w-3xl">
                {started && (
                  <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                    {C.quick[lang].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => ask(q)}
                        className="hp-focus shrink-0 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-[13px] text-white/80 hover:border-[var(--tk-cyan)]/50 hover:text-white"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(draft);
                  }}
                  className="flex items-end gap-2 rounded-[22px] border border-white/12 bg-white/[0.06] p-2 transition-colors focus-within:border-[var(--tk-cyan)]/60"
                >
                  <MicButton state={dict.state} onClick={dict.start} lang={lang} size={42} />
                  <textarea
                    ref={input}
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        ask(draft);
                      }
                    }}
                    placeholder={dict.state === "listening" ? C.listening[lang] : H.placeholder[lang]}
                    aria-label={H.placeholder[lang]}
                    className="min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[16px] leading-6 text-white placeholder:text-white/40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    aria-label={C.ask[lang]}
                    className="hp-cta hp-focus grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-40"
                  >
                    <ArrowUp size={18} aria-hidden />
                  </button>
                </form>
                {(dict.state === "denied" || dict.state === "unsupported") && (
                  <p className="hp-warn mt-2 text-[13px]">{dict.state === "denied" ? C.denied[lang] : C.unsupported[lang]}</p>
                )}
                <p className="mt-2 text-center text-[12px] text-white/45">{H.note[lang]}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {sheet && <Concierge first={sheet.first} voice={sheet.voice} onClose={() => setSheet(null)} />}
    </div>
  );
}
