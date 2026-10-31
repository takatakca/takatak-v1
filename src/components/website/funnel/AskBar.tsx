"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowRight, ArrowUp, Check, Headset, Mic, Plus, Sparkles, X } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { respond, suggest, type Reply } from "@/lib/website/concierge";
import { CORE_CATEGORIES, type CategoryKey } from "@/lib/website/core-categories";
import { SERVICE_MEDIA } from "@/lib/website/home-media";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { PROMO_CODE, PROMO_PERCENT } from "@/lib/website/promotions";
import { CampaignCountdown, useActiveCampaign } from "./Campaign";

type Lang = "en" | "fr";

const C = {
  title: { en: "What can we do for your business?", fr: "Qu’est-ce qu’on fait pour votre entreprise ?" },
  examples: {
    en: ["I need a website for my restaurant", "Get more Google reviews", "Find a .ca domain", "Post on Instagram and Facebook", "Send invoices with GST and QST"],
    fr: ["Il me faut un site pour mon restaurant", "Avoir plus d’avis Google", "Trouver un domaine .ca", "Publier sur Instagram et Facebook", "Facturer avec TPS et TVQ"],
  },
  ask: { en: "Ask", fr: "Demander" },
  mic: { en: "Speak your request", fr: "Dites votre demande" },
  listening: { en: "Listening…", fr: "Je vous écoute…" },
  denied: { en: "Microphone blocked. You can type your request.", fr: "Micro refusé. Vous pouvez écrire votre demande." },
  unsupported: { en: "Voice isn’t available in this browser. Type your request.", fr: "La dictée n’est pas offerte par ce navigateur. Écrivez votre demande." },
  askAgent: { en: "Ask the assistant: “{q}”", fr: "Demander à l’assistant : « {q} »" },
  add: { en: "Add", fr: "Ajouter" },
  added: { en: "Added", fr: "Ajouté" },
  agent: { en: "TAKATAK assistant", fr: "Assistant TAKATAK" },
  agentNote: { en: "Guided answers from our catalog · a person can take over", fr: "Réponses guidées par notre catalogue · une personne peut prendre le relais" },
  hello: {
    en: "Hi! Tell me about your business or what you want to do, and I’ll put together the right services with real prices.",
    fr: "Bonjour ! Parlez-moi de votre entreprise ou de ce que vous voulez faire, et je vous propose les bons services, avec les vrais prix.",
  },
  welcome: {
    en: "Good news: as a new client you get {p}% off your first service with code {code}. It is applied at checkout.",
    fr: "Bonne nouvelle : comme nouveau client, vous avez {p} % sur votre premier service avec le code {code}. Il s’applique au paiement.",
  },
  finalize: { en: "Finalize my order", fr: "Finaliser ma commande" },
  human: { en: "Talk to a person", fr: "Parler à une personne" },
  placeholder: { en: "Write or speak…", fr: "Écrivez ou parlez…" },
  quick: {
    en: ["A website", "Get found on Google", "More customers", "I run a restaurant", "Any deals?"],
    fr: ["Un site web", "Être trouvé sur Google", "Plus de clients", "J’ai un restaurant", "Des rabais ?"],
  },
  close: { en: "Close", fr: "Fermer" },
} as const;

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

/** Browser dictation: the browser itself asks for microphone permission on first use. */
function useDictation(lang: Lang, onText: (text: string) => void) {
  const [state, setState] = useState<"idle" | "listening" | "denied" | "unsupported">("idle");
  const rec = useRef<InstanceType<SpeechCtor> | null>(null);
  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setState("unsupported");
      return;
    }
    if (state === "listening") {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = lang === "fr" ? "fr-CA" : "en-CA";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => onText(Array.from(e.results).map((res) => res[0]?.transcript ?? "").join(" "));
    r.onerror = (e) => setState(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "idle");
    r.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.current = r;
    setState("listening");
    try {
      r.start();
    } catch {
      setState("idle");
    }
  }, [lang, onText, state]);
  useEffect(
    () => () => {
      rec.current?.stop();
    },
    [],
  );
  return { state, start };
}

function MicButton({ state, onClick, lang, size = 48 }: { state: string; onClick: () => void; lang: Lang; size?: number }) {
  const on = state === "listening";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={C.mic[lang]}
      title={C.mic[lang]}
      className={`hp-mic hp-focus relative grid shrink-0 place-items-center rounded-full ${on ? "hp-mic-on" : ""}`}
      style={{ width: size, height: size }}
    >
      <span className="hp-raised relative z-[1] grid h-[calc(100%-6px)] w-[calc(100%-6px)] place-items-center rounded-full">
        <Mic size={Math.round(size * 0.4)} className={on ? "text-[#E11D48]" : "hp-ink"} aria-hidden />
      </span>
    </button>
  );
}

function ServiceRow({ k, lang, tk }: { k: CategoryKey; lang: Lang; tk: (key: string) => string }) {
  const plan = useHomePlan();
  const c = CORE_CATEGORIES.find((x) => x.key === k)!;
  const m = SERVICE_MEDIA[k];
  const on = plan.has(k);
  const price = typeof c.from === "string" ? tk(c.from === "quote" ? "cat.onQuote" : "cat.planned") : `${money(lang, c.from.amount)}${cadenceSuffix(tk, c.from.cadence)}`;
  return (
    <div className="hp-card flex items-center gap-3 rounded-2xl p-2.5">
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
        <Image src={m.photo} alt="" fill sizes="48px" className="object-cover" style={{ objectPosition: m.focus, transform: `scale(${m.zoom})` }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="hp-ink block text-[14.5px] font-semibold">{tk(`cat.${k}.name`)}</span>
        <span className="hp-ink-2 block text-[12.5px]">{price}</span>
      </span>
      <button
        type="button"
        onClick={() => plan.toggle(k)}
        aria-pressed={on}
        className={`hp-focus inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-semibold ${on ? "hp-ghost" : "hp-btn"}`}
      >
        {on ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />} {on ? C.added[lang] : C.add[lang]}
      </button>
    </div>
  );
}

interface Msg {
  from: "bot" | "me";
  text: string;
  reply?: Reply;
}

/** The conversation panel: guided, catalog-grounded, ends on "Finalize my order". */
function Concierge({ first, onClose }: { first: string; onClose: () => void }) {
  const { tk, lang } = useCopy();
  const campaign = useActiveCampaign();
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: C.hello[lang] }]);
  const [offered, setOffered] = useState(false);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const dict = useDictation(lang, setDraft);

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      const reply = respond(q, offered);
      if (reply.actions.includes("offer_welcome")) setOffered(true);
      setMsgs((m) => [...m, { from: "me", text: q }, { from: "bot", text: reply.text[lang], reply }]);
      setDraft("");
    },
    [lang, offered],
  );

  const sentFirst = useRef(false);
  useEffect(() => {
    if (first && !sentFirst.current) {
      sentFirst.current = true;
      send(first);
    }
  }, [first, send]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="hp hp-portal fixed inset-0 z-[120] flex justify-end" data-theme={document.querySelector(".hp")?.getAttribute("data-theme") ?? "light"} role="dialog" aria-modal="true" aria-label={C.agent[lang]}>
      <div className="tk-fade-in absolute inset-0 bg-[#05070C]/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside className="hp-bg hp-sheet-in relative flex h-full w-full max-w-[460px] flex-col shadow-[-30px_0_80px_-30px_rgb(0_0_0/0.5)]">
        <header className="hp-line flex items-center gap-3 border-b px-5 py-4">
          <span className="hp-orb relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-white">
            <Sparkles size={17} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="hp-ink block text-[15.5px] font-semibold">{C.agent[lang]}</span>
            <span className="hp-ink-3 block truncate text-[12px]">{C.agentNote[lang]}</span>
          </span>
          <button type="button" onClick={onClose} aria-label={C.close[lang]} className="hp-ghost hp-focus grid h-9 w-9 place-items-center rounded-full">
            <X size={16} aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
          <ol className="grid gap-3">
            {msgs.map((m, i) => (
              <li key={i} className={`tk-stagger grid gap-2 ${m.from === "me" ? "justify-items-end" : ""}`}>
                <p
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-6 ${
                    m.from === "me" ? "rounded-tr-md bg-[var(--hp-cta)] text-white" : "hp-card hp-ink rounded-tl-md"
                  }`}
                >
                  {m.text}
                </p>
                {m.reply?.services.length ? (
                  <div className="grid w-full gap-2">
                    {m.reply.services.map((k) => (
                      <ServiceRow key={k} k={k} lang={lang} tk={tk} />
                    ))}
                  </div>
                ) : null}
                {m.reply?.actions.includes("offer_welcome") && (
                  <div className="w-full rounded-2xl border border-dashed border-[var(--hp-cta)] p-3.5">
                    <p className="hp-ink text-[14px]">{fill(C.welcome[lang], { p: PROMO_PERCENT, code: PROMO_CODE })}</p>
                    {campaign && <CampaignCountdown campaign={campaign} lang={lang} className="mt-2.5" />}
                  </div>
                )}
                {m.reply && (m.reply.actions.includes("finalize") || m.reply.actions.includes("human")) && (
                  <div className="flex flex-wrap gap-2">
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
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {C.quick[lang].map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="hp-ghost hp-focus rounded-full px-3.5 py-1.5 text-[13px]">
                {q}
              </button>
            ))}
          </div>
          <div ref={endRef} />
        </div>
        <form
          className="hp-line flex items-center gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <MicButton state={dict.state} onClick={dict.start} lang={lang} size={42} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={dict.state === "listening" ? C.listening[lang] : C.placeholder[lang]}
            aria-label={C.placeholder[lang]}
            className="hp-card hp-ink min-w-0 flex-1 rounded-full px-4 py-3 text-[14.5px] placeholder:text-[var(--hp-ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--hp-cta)]"
          />
          <button type="submit" aria-label={C.ask[lang]} className="hp-cta hp-focus grid h-11 w-11 shrink-0 place-items-center rounded-full">
            <ArrowUp size={18} aria-hidden />
          </button>
        </form>
        {(dict.state === "denied" || dict.state === "unsupported") && (
          <p className="hp-warn px-5 pb-3 text-[12.5px]">{dict.state === "denied" ? C.denied[lang] : C.unsupported[lang]}</p>
        )}
      </aside>
    </div>,
    document.querySelector(".website-surface") ?? document.body,
  );
}

/**
 * "What can we do for your business?": type or speak, see matching services
 * with real prices as you go, add them, or hand the question to the assistant.
 */
export function AskBar() {
  const { tk, lang } = useCopy();
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const [example, setExample] = useState(0);
  const [agent, setAgent] = useState<string | null>(null);
  const dict = useDictation(lang, setText);
  const suggestions = suggest(text);

  useEffect(() => {
    if (text || focus) return;
    const t = window.setInterval(() => setExample((n) => (n + 1) % C.examples[lang].length), 3200);
    return () => window.clearInterval(t);
  }, [text, focus, lang]);

  const open = (q: string) => {
    setAgent(q);
    setFocus(false);
  };

  return (
    <section aria-labelledby="home-ask-title" className="hp-bg pb-6 pt-14 sm:pt-20">
      <div className="mx-auto max-w-4xl px-4">
        <h2 id="home-ask-title" className="hp-display hp-ink text-balance text-center text-[30px] sm:text-[44px]">
          {C.title[lang]}
        </h2>
        <form
          className="relative mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            open(text);
          }}
        >
          <div className="hp-ask hp-raised relative flex items-center gap-2 rounded-full p-2 pl-3 ring-1 ring-[var(--hp-line)]">
            <MicButton state={dict.state} onClick={dict.start} lang={lang} />
            <div className="relative min-w-0 flex-1">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setFocus(true)}
                onBlur={() => window.setTimeout(() => setFocus(false), 150)}
                aria-label={C.title[lang]}
                className="hp-ink w-full bg-transparent px-2 py-3 text-[17px] focus:outline-none sm:text-[18px]"
              />
              {!text && (
                <span aria-hidden className="hp-ink-3 pointer-events-none absolute inset-y-0 left-2 flex items-center text-[17px] sm:text-[18px]">
                  <span key={`${example}-${dict.state}`} className="tk-fade-in truncate">
                    {dict.state === "listening" ? C.listening[lang] : C.examples[lang][example]}
                  </span>
                </span>
              )}
            </div>
            <button type="submit" className="hp-cta hp-halo hp-focus inline-flex shrink-0 items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold">
              {C.ask[lang]} <ArrowRight size={16} aria-hidden />
            </button>
          </div>
          {(dict.state === "denied" || dict.state === "unsupported") && (
            <p className="hp-warn mt-2 text-center text-[13px]">{dict.state === "denied" ? C.denied[lang] : C.unsupported[lang]}</p>
          )}
          {focus && text.trim().length >= 2 && (
            <div className="hp-raised tk-modal-in absolute inset-x-0 top-full z-20 mt-2 rounded-[24px] p-2 ring-1 ring-[var(--hp-line)]">
              <button type="button" onClick={() => open(text)} className="hp-ink hp-focus flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-[14.5px] hover:bg-[var(--hp-alt)]">
                <Sparkles size={16} className="hp-accent shrink-0" aria-hidden />
                <span className="truncate">{fill(C.askAgent[lang], { q: text.trim() })}</span>
              </button>
              {suggestions.length > 0 && (
                <div className="grid gap-2 p-1">
                  {suggestions.map((k) => (
                    <ServiceRow key={k} k={k} lang={lang} tk={tk} />
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {C.quick[lang].slice(0, 4).map((q) => (
            <button key={q} type="button" onClick={() => open(q)} className="hp-ghost hp-focus rounded-full px-4 py-2 text-[13.5px]">
              {q}
            </button>
          ))}
        </div>
      </div>
      {agent !== null && <Concierge first={agent} onClose={() => setAgent(null)} />}
    </section>
  );
}
