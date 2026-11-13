"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowRight, ArrowUp, Check, ClipboardList, Globe, Headset, LayoutTemplate, MapPin, Megaphone, Mic, PenTool, Plus, Server, Sparkles, Volume2, VolumeX, X } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { HERO_CHIPS, respond, suggest, type Reply } from "@/lib/website/concierge";
import { CORE_CATEGORIES, type CategoryKey } from "@/lib/website/core-categories";
import { SERVICE_MEDIA } from "@/lib/website/home-media";
import { useHomePlan } from "@/lib/website/home-plan";
import { fill } from "@/lib/website/home-funnel";
import { Link } from "@/lib/website/nav";
import { PROMO_CODE, PROMO_PERCENT } from "@/lib/website/promotions";
import { FICHE_CONFIRM, FICHE_LABELS, FICHE_ORDER, answer, emptyFiche, fichePayload, question, type Fiche, type FicheStep } from "@/lib/website/sales-fiche";
import { submitWebsiteRequest } from "@/lib/website/website-requests";
import { CampaignCountdown, useActiveCampaign } from "./Campaign";
import { sectionId } from "./HomeSectionNav";
import { CONCIERGE_OPEN_EVENT } from "./OfferRail";
import { RobotMascot } from "./RobotMascot";
import { prefillTakbot } from "./TakbotTryPanel";

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
  agent: { en: "TAK-TAK", fr: "TAK-TAK" },
  agentRole: { en: "TAKATAK sales assistant", fr: "Assistant ventes TAKATAK" },
  askTakbot: { en: "Ask TAK-TAK (AI)", fr: "Demander à TAK-TAK (IA)" },
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
  prepare: { en: "Prepare my request", fr: "Préparer ma demande" },
  support: { en: "Contact support", fr: "Contacter le soutien" },
  fiche: { en: "Your request", fr: "Votre demande" },
  yes: { en: "Yes, send it", fr: "Oui, envoyer" },
  fix: { en: "Correct", fr: "Corriger" },
  sent: { en: "Sent. Your reference: {ref}. We reply within one business day. You can also order right now:", fr: "Envoyé. Votre référence : {ref}. On vous répond en un jour ouvrable. Vous pouvez aussi commander tout de suite :" },
  failed: { en: "I could not send it right now. A person can take over in the chat.", fr: "Je n’ai pas pu l’envoyer pour l’instant. Une personne peut prendre le relais dans le clavardage." },
  voiceOn: { en: "Voice replies on", fr: "Réponses à voix haute" },
  voiceOff: { en: "Voice replies off", fr: "Réponses en texte" },
  human: { en: "Talk to a person", fr: "Parler à une personne" },
  placeholder: { en: "Write or speak…", fr: "Écrivez ou parlez…" },
  quick: {
    en: ["A website", "Get found on Google", "More customers", "I run a restaurant", "Any deals?"],
    fr: ["Un site web", "Être trouvé sur Google", "Plus de clients", "J’ai un restaurant", "Des rabais ?"],
  },
  close: { en: "Close", fr: "Fermer" },
  role: { en: "TAKATAK’s assistant", fr: "l’assistant de TAKATAK" },
  greet: {
    // Non-breaking hyphen: the name never splits over two lines.
    en: "Hi! I’m TAK\u2011TAK. Tell me what you want to do and I’ll show you the right services, with real prices.",
    fr: "Bonjour ! Moi, c’est TAK\u2011TAK. Dites-moi ce que vous voulez faire et je vous montre les bons services, avec les vrais prix.",
  },
  typing: { en: "TAK-TAK is typing", fr: "TAK-TAK écrit" },
  starts: { en: "Where to start", fr: "Par où commencer" },
} as const;


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
        <span className="hp-ink-2 block text-[13.5px]">{price}</span>
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
function Concierge({ first, onClose, voice = false }: { first: string; onClose: () => void; voice?: boolean }) {
  const { tk, lang } = useCopy();
  const campaign = useActiveCampaign();
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: C.hello[lang] }]);
  const [offered, setOffered] = useState(false);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const dict = useDictation(lang, setDraft);
  // The request form the assistant fills from the conversation.
  const [step, setStep] = useState<FicheStep | "sending" | "done" | null>(null);
  const [fiche, setFiche] = useState<Fiche>(emptyFiche);
  const [speak, setSpeak] = useState(voice);
  const seenServices = useRef<string[]>([]);
  // The live TAK-TAK is on the homepage only.
  const [hasTakbot] = useState(() => typeof document !== "undefined" && Boolean(document.getElementById(sectionId("takbot"))));
  const toTakbot = (q: string) => {
    onClose();
    window.setTimeout(() => prefillTakbot(q, "chat"), 50);
  };

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      setDraft("");
      if (step && step !== "confirm" && step !== "sending" && step !== "done") {
        const r = answer(step, q, fiche);
        if (!r.ok) {
          setMsgs((m) => [...m, { from: "me", text: q }, { from: "bot", text: r.error[lang] }]);
          return;
        }
        setFiche(r.fiche);
        setStep(r.next);
        setMsgs((m) => [...m, { from: "me", text: q }, { from: "bot", text: r.next === "confirm" ? FICHE_CONFIRM[lang] : question(r.next, r.fiche, lang) }]);
        return;
      }
      const reply = respond(q, offered);
      if (reply.actions.includes("offer_welcome")) setOffered(true);
      for (const k of reply.services) if (!seenServices.current.includes(k)) seenServices.current.push(k);
      setMsgs((m) => [...m, { from: "me", text: q }, { from: "bot", text: reply.text[lang], reply }]);
    },
    [lang, offered, step, fiche],
  );

  const startFiche = () => {
    if (step) return;
    setStep(FICHE_ORDER[0]);
    setMsgs((m) => [...m, { from: "bot", text: question(FICHE_ORDER[0], fiche, lang) }]);
  };

  const submitFiche = async () => {
    setStep("sending");
    const services = seenServices.current.map((k) => tk(`cat.${k}.name`));
    const conversation = msgs.filter((m) => m.from === "me").map((m) => `> ${m.text}`);
    const result = await submitWebsiteRequest(fichePayload(fiche, { services, conversation, lang }));
    setStep("done");
    setMsgs((m) => [
      ...m,
      result.status === "sent"
        ? { from: "bot", text: fill(C.sent[lang], { ref: result.reference }), reply: { text: { fr: "", en: "" }, services: [], actions: ["finalize"] } }
        : { from: "bot", text: C.failed[lang], reply: { text: { fr: "", en: "" }, services: [], actions: ["human"] } },
    ]);
  };

  // Voice: the assistant reads its answers aloud, and a finished dictation is sent.
  useEffect(() => {
    if (!speak || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const last = msgs[msgs.length - 1];
    if (!last || last.from !== "bot") return;
    const u = new SpeechSynthesisUtterance(last.text);
    u.lang = lang === "fr" ? "fr-CA" : "en-CA";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [msgs, speak, lang]);
  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);
  const wasListening = useRef(false);
  useEffect(() => {
    if (dict.state === "listening") wasListening.current = true;
    else if (wasListening.current && dict.state === "idle") {
      wasListening.current = false;
      if (speak && draft.trim()) send(draft);
    }
  }, [dict.state, speak, draft, send]);
  const startedVoice = useRef(false);
  useEffect(() => {
    if (voice && !startedVoice.current) {
      startedVoice.current = true;
      dict.start();
    }
  }, [voice, dict]);

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
    <div className="hp hp-portal fixed inset-0 z-[120] flex justify-end" data-theme={document.querySelector(".hp:not([data-hero])")?.getAttribute("data-theme") ?? "light"} role="dialog" aria-modal="true" aria-label={`${C.agent[lang]} · ${C.agentRole[lang]}`}>
      <div className="tk-fade-in absolute inset-0 bg-[#05070C]/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside className="hp-bg hp-sheet3d relative flex h-full w-full max-w-[460px] flex-col shadow-[-30px_0_80px_-30px_rgb(0_0_0/0.5)]">
        <header className="hp-line flex items-center gap-3 border-b px-5 py-4">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#060D1F] ring-1 ring-[var(--hp-line)]">
            <RobotMascot headOnly size={32} wave={false} title="TAK-TAK" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="hp-ink block text-[15.5px] font-semibold">{C.agent[lang]}</span>
            <span className="hp-ink-3 block truncate text-[13px]">{C.agentRole[lang]}</span>
          </span>
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
          <button type="button" onClick={onClose} aria-label={C.close[lang]} className="hp-ghost hp-focus grid h-9 w-9 place-items-center rounded-full">
            <X size={16} aria-hidden />
          </button>
        </header>
        {step && (
          <div className="hp-line hp-card tk-fade-in mx-4 mt-3 rounded-2xl border p-3.5" aria-live="polite">
            <p className="hp-ink-3 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em]">
              <ClipboardList size={13} aria-hidden /> {C.fiche[lang]}
            </p>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13.5px]">
              {FICHE_ORDER.map((f) => (
                <Fragment key={f}>
                  <dt className="hp-ink-3">{FICHE_LABELS[f][lang]}</dt>
                  <dd className={`hp-ink truncate font-semibold ${step === f ? "rounded bg-[var(--hp-alt)] px-1.5" : ""}`}>
                    {fiche[f] ? (
                      <span key={fiche[f]} className="tk-fade-in">
                        {fiche[f]}
                      </span>
                    ) : step === f ? (
                      <span className="hp-caret" aria-hidden />
                    ) : (
                      <span className="hp-ink-3 font-normal">—</span>
                    )}
                  </dd>
                </Fragment>
              ))}
            </dl>
            {step === "confirm" && (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void submitFiche()} className="hp-cta hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold">
                  <Check size={14} aria-hidden /> {C.yes[lang]}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFiche(emptyFiche());
                    setStep(FICHE_ORDER[0]);
                    setMsgs((m) => [...m, { from: "bot", text: question(FICHE_ORDER[0], emptyFiche(), lang) }]);
                  }}
                  className="hp-ghost hp-focus rounded-full px-4 py-2 text-[13.5px] font-semibold"
                >
                  {C.fix[lang]}
                </button>
              </div>
            )}
          </div>
        )}
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
                {m.reply?.links?.map((l) => (
                  <Link key={l.to} to={l.to} className="hp-cta hp-focus inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold">
                    {l.label[lang]} <ArrowRight size={15} aria-hidden />
                  </Link>
                ))}
                {m.reply?.actions.includes("offer_welcome") && (
                  <div className="w-full rounded-2xl border border-dashed border-[var(--hp-cta)] p-3.5">
                    <p className="hp-ink text-[14px]">{fill(C.welcome[lang], { p: PROMO_PERCENT, code: PROMO_CODE })}</p>
                    {campaign && <CampaignCountdown campaign={campaign} lang={lang} className="mt-2.5" />}
                  </div>
                )}
                {m.reply && hasTakbot && msgs[i - 1]?.from === "me" && !m.reply.actions.includes("support") && (
                  <button
                    type="button"
                    onClick={() => toTakbot(msgs[i - 1].text)}
                    className="hp-ghost hp-focus inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                  >
                    <Sparkles size={14} aria-hidden /> {C.askTakbot[lang]}
                  </button>
                )}
                {m.reply?.actions.includes("support") && (
                  <button
                    type="button"
                    onClick={() => openLiveChat({ page: "/", intent: "support", lang })}
                    className="hp-cta hp-focus inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold"
                  >
                    <Headset size={15} aria-hidden /> {C.support[lang]}
                  </button>
                )}
                {m.reply && (m.reply.actions.includes("finalize") || m.reply.actions.includes("human")) && (
                  <div className="flex flex-wrap gap-2">
                    {m.reply.actions.includes("finalize") && !step && (
                      <button type="button" onClick={startFiche} className="hp-ghost hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold">
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
          <p className="hp-warn px-5 pb-3 text-[13.5px]">{dict.state === "denied" ? C.denied[lang] : C.unsupported[lang]}</p>
        )}
      </aside>
    </div>,
    document.querySelector(".website-surface") ?? document.body,
  );
}

const CHIP_ICON: Record<string, typeof Globe> = { domains: Globe, website: LayoutTemplate, hosting: Server, leads: MapPin, logo: PenTool, marketing: Megaphone };

/** TAK-TAK says hello once, after a short "typing" pause (immediately with reduced motion). */
function useGreeting() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setReady(true), still ? 0 : 1100);
    return () => window.clearTimeout(t);
  }, []);
  return ready;
}

/**
 * Homepage hero, right side: TAK-TAK, the TAKATAK robot, welcomes the visitor.
 * One bar (type or speak) with matching services and real prices as you go,
 * six starting points under it, and every question opens the guided assistant.
 * The other homepage sections open the same assistant (CONCIERGE_OPEN_EVENT).
 */
export function AskBar() {
  const { tk, lang } = useCopy();
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const [example, setExample] = useState(0);
  const [agent, setAgent] = useState<string | null>(null);
  const [voice, setVoice] = useState(false);
  const dict = useDictation(lang, setText);
  const greeted = useGreeting();
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ first?: string; voice?: boolean }>).detail ?? {};
      setVoice(Boolean(d.voice));
      setAgent(typeof d.first === "string" ? d.first.slice(0, 300) : "");
    };
    window.addEventListener(CONCIERGE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONCIERGE_OPEN_EVENT, onOpen);
  }, []);
  const suggestions = suggest(text, 3);

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
    // Dark homepage tokens on the navy hero; data-hero keeps the assistant on the page's own theme.
    <div className="hp relative z-30 mx-auto w-full max-w-[600px] lg:max-w-none" data-theme="dark" data-hero style={{ background: "transparent" }}>
      <div aria-hidden className="pointer-events-none absolute -inset-8 rounded-[48px] bg-[radial-gradient(closest-side,rgb(31_139_255/0.32),transparent)] blur-2xl" />
      <div className="tk-hero-ring relative rounded-[30px] p-px">
        <span aria-hidden className="tk-hero-ring-layer" />
        <div className="relative rounded-[29px] bg-[#071330]/90 px-4 pb-5 pt-5 backdrop-blur-xl sm:px-7 sm:pb-7 sm:pt-6">
          {/* TAK-TAK and its hello */}
          <div className="flex items-end gap-3 sm:gap-5">
            <div className="-mt-14 shrink-0 sm:-mt-20">
              <RobotMascot size={92} title="TAK-TAK" className="sm:hidden" />
              <RobotMascot size={138} title="TAK-TAK" className="hidden sm:block" />
            </div>
            <div className="min-w-0 flex-1 pb-3">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--tk-cyan)]">
                TAK-TAK <span className="font-medium normal-case tracking-normal text-white/55">· {C.role[lang]}</span>
              </p>
              <div className="relative mt-2 min-h-[64px] rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3 ring-1 ring-white/10" aria-live="polite">
                {greeted ? (
                  <p className="tk-fade-in text-[14.5px] leading-6 text-white/90 sm:text-[15.5px]">{C.greet[lang]}</p>
                ) : (
                  <span className="flex h-6 items-center gap-1.5" aria-label={C.typing[lang]}>
                    <span className="tk-typing-dot" />
                    <span className="tk-typing-dot [animation-delay:0.15s]" />
                    <span className="tk-typing-dot [animation-delay:0.3s]" />
                  </span>
                )}
              </div>
            </div>
          </div>

          <h2 id="home-ask-title" className="hp-display hp-ink mt-5 text-balance text-[24px] sm:mt-6 sm:text-[32px]">
            {C.title[lang]}
          </h2>
          <form
            className="relative mt-4 sm:mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              open(text);
            }}
          >
            <div className="hp-ask hp-raised relative flex items-center gap-2 rounded-full p-1.5 pl-2 ring-1 ring-[var(--hp-line)] sm:p-2 sm:pl-3">
              <MicButton state={dict.state} onClick={dict.start} lang={lang} size={44} />
              <div className="relative min-w-0 flex-1">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={() => setFocus(true)}
                  onBlur={() => window.setTimeout(() => setFocus(false), 150)}
                  aria-label={C.title[lang]}
                  className="hp-ink w-full bg-transparent px-1.5 py-3 text-[16px] focus:outline-none sm:px-2 sm:text-[17px]"
                />
                {!text && (
                  <span aria-hidden className="hp-ink-3 pointer-events-none absolute inset-y-0 left-1.5 right-0 flex items-center text-[16px] sm:left-2 sm:text-[17px]">
                    <span key={`${example}-${dict.state}`} className="tk-text-in truncate">
                      {dict.state === "listening" ? C.listening[lang] : C.examples[lang][example]}
                    </span>
                  </span>
                )}
              </div>
              <button type="submit" className="hp-cta hp-halo hp-focus inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-3 text-[15px] font-semibold sm:px-6 sm:py-3.5">
                <span className="hidden sm:inline">{C.ask[lang]}</span> <ArrowRight size={16} aria-hidden />
                <span className="sr-only sm:hidden">{C.ask[lang]}</span>
              </button>
            </div>
            {(dict.state === "denied" || dict.state === "unsupported") && (
              <p className="hp-warn mt-2 text-[13px]">{dict.state === "denied" ? C.denied[lang] : C.unsupported[lang]}</p>
            )}
            {focus && text.trim().length >= 2 && (
              <div className="hp-raised tk-modal-in absolute inset-x-0 top-full z-40 mt-2 rounded-[24px] p-2 ring-1 ring-[var(--hp-line)]">
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

          {/* Six starting points: each one asks TAK-TAK */}
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label={C.starts[lang]}>
            {HERO_CHIPS.map((c) => {
              const Icon = CHIP_ICON[c.key] ?? Sparkles;
              return (
                <li key={c.key} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => open(c.ask[lang])}
                    className="hp-focus inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2 py-2 text-center text-[12.5px] font-medium leading-tight text-white/85 transition-colors hover:border-[var(--tk-cyan)]/60 hover:bg-white/[0.1] hover:text-white sm:w-auto sm:px-3.5 sm:text-[13px]"
                  >
                    <Icon size={14} className="hidden shrink-0 text-[var(--tk-cyan)] sm:block" aria-hidden /> {c.label[lang]}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[12.5px] text-white/50">{C.agentNote[lang]}</p>
        </div>
      </div>
      {agent !== null && (
        <Concierge
          first={agent}
          voice={voice}
          onClose={() => {
            setAgent(null);
            setVoice(false);
          }}
        />
      )}
    </div>
  );
}
