"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowRight, ArrowUp, Check, ClipboardList, Headset, Mail, Mic, Plus, Sparkles, Volume2, VolumeX, X } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { respond, type Reply } from "@/lib/website/concierge";
import { CORE_CATEGORIES, type CategoryKey } from "@/lib/website/core-categories";
import { SERVICE_MEDIA } from "@/lib/website/home-media";
import { useHomePlan } from "@/lib/website/home-plan";
import { fill } from "@/lib/website/home-funnel";
import { Link } from "@/lib/website/nav";
import { PROMO_CODE, PROMO_PERCENT } from "@/lib/website/promotions";
import { FICHE_CONFIRM, FICHE_LABELS, FICHE_ORDER, answer, emptyFiche, fichePayload, question, type Fiche, type FicheStep } from "@/lib/website/sales-fiche";
import { submitWebsiteRequest } from "@/lib/website/website-requests";
import { supportMailto } from "@/components/website/support/EmailFallback";
import { CampaignCountdown, useActiveCampaign } from "./Campaign";
import { sectionId } from "./HomeSectionNav";
import { RobotMascot } from "./RobotMascot";
import { prefillTakbot } from "./TakbotTryPanel";

type Lang = "en" | "fr";

export const C = {
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
  failed: {
    en: "Online sending is paused. Your request is ready in an email: send it and the team answers within one business day.",
    fr: "L’envoi en ligne est en pause. Votre demande est prête dans un courriel : envoyez-le et l’équipe répond en un jour ouvrable.",
  },
  mailIt: { en: "Send by email", fr: "Envoyer par courriel" },
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
export function useDictation(lang: Lang, onText: (text: string) => void) {
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

export function MicButton({ state, onClick, lang, size = 48 }: { state: string; onClick: () => void; lang: Lang; size?: number }) {
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

export function ServiceRow({ k, lang, tk }: { k: CategoryKey; lang: Lang; tk: (key: string) => string }) {
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

export interface Msg {
  from: "bot" | "me";
  text: string;
  reply?: Reply;
  /** The request as a ready-to-send email when online sending is paused. */
  mail?: string;
}

/**
 * One TAK-TAK conversation: catalog-grounded replies, the request form the
 * assistant fills from the chat, and the send. Shared by the side sheet and
 * the full-screen homepage chat.
 */
export function useConversation(lang: Lang, tk: (key: string) => string, { greet = true }: { greet?: boolean } = {}) {
  const [msgs, setMsgs] = useState<Msg[]>(() => (greet ? [{ from: "bot", text: C.hello[lang] }] : []));
  const [offered, setOffered] = useState(false);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState<FicheStep | "sending" | "done" | null>(null);
  const [fiche, setFiche] = useState<Fiche>(emptyFiche);
  const seenServices = useRef<string[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  /** The reply appears after a short "typing" beat (at once with reduced motion). */
  const botSays = useCallback((add: Msg) => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTyping(true);
    timers.current.push(
      window.setTimeout(() => {
        setTyping(false);
        setMsgs((m) => [...m, add]);
      }, still ? 0 : 480),
    );
  }, []);

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      if (step && step !== "confirm" && step !== "sending" && step !== "done") {
        const r = answer(step, q, fiche);
        setMsgs((m) => [...m, { from: "me", text: q }]);
        if (!r.ok) {
          botSays({ from: "bot", text: r.error[lang] });
          return;
        }
        setFiche(r.fiche);
        setStep(r.next);
        botSays({ from: "bot", text: r.next === "confirm" ? FICHE_CONFIRM[lang] : question(r.next, r.fiche, lang) });
        return;
      }
      const reply = respond(q, offered);
      if (reply.actions.includes("offer_welcome")) setOffered(true);
      for (const k of reply.services) if (!seenServices.current.includes(k)) seenServices.current.push(k);
      setMsgs((m) => [...m, { from: "me", text: q }]);
      botSays({ from: "bot", text: reply.text[lang], reply });
    },
    [lang, offered, step, fiche, botSays],
  );

  const startFiche = useCallback(() => {
    if (step) return;
    setStep(FICHE_ORDER[0]);
    botSays({ from: "bot", text: question(FICHE_ORDER[0], fiche, lang) });
  }, [step, fiche, lang, botSays]);

  const correctFiche = useCallback(() => {
    setFiche(emptyFiche());
    setStep(FICHE_ORDER[0]);
    botSays({ from: "bot", text: question(FICHE_ORDER[0], emptyFiche(), lang) });
  }, [lang, botSays]);

  const submitFiche = useCallback(async () => {
    setStep("sending");
    const services = seenServices.current.map((k) => tk(`cat.${k}.name`));
    const conversation = msgs.filter((m) => m.from === "me").map((m) => `> ${m.text}`);
    const result = await submitWebsiteRequest(fichePayload(fiche, { services, conversation, lang }));
    setStep("done");
    if (result.status === "sent") {
      botSays({ from: "bot", text: fill(C.sent[lang], { ref: result.reference }), reply: { text: { fr: "", en: "" }, services: [], actions: ["finalize"] } });
      return;
    }
    const lines = [
      ...FICHE_ORDER.map((f) => (fiche[f] ? `${FICHE_LABELS[f][lang]} : ${fiche[f]}` : "")),
      services.length ? `${lang === "fr" ? "Services" : "Services"} : ${services.join(", ")}` : "",
      ...conversation,
    ];
    botSays({
      from: "bot",
      text: C.failed[lang],
      mail: supportMailto(`TAKATAK · ${C.fiche[lang]}`, lines),
      reply: { text: { fr: "", en: "" }, services: [], actions: ["human"] },
    });
  }, [msgs, fiche, lang, tk, botSays]);

  const reset = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    seenServices.current = [];
    setTyping(false);
    setOffered(false);
    setStep(null);
    setFiche(emptyFiche());
    setMsgs(greet ? [{ from: "bot", text: C.hello[lang] }] : []);
  }, [greet, lang]);

  return { msgs, typing, step, fiche, send, startFiche, correctFiche, submitFiche, reset };
}

/** The conversation panel: guided, catalog-grounded, ends on "Finalize my order". */
export function Concierge({ first, onClose, voice = false }: { first: string; onClose: () => void; voice?: boolean }) {
  const { tk, lang } = useCopy();
  const campaign = useActiveCampaign();
  const convo = useConversation(lang, tk);
  const { msgs, step, fiche, startFiche, submitFiche } = convo;
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const dict = useDictation(lang, setDraft);
  const [speak, setSpeak] = useState(voice);
  // The live TAK-TAK is on the homepage only.
  const [hasTakbot] = useState(() => typeof document !== "undefined" && Boolean(document.getElementById(sectionId("takbot"))));
  const toTakbot = (q: string) => {
    onClose();
    window.setTimeout(() => prefillTakbot(q, "chat"), 50);
  };
  const send = useCallback(
    (text: string) => {
      setDraft("");
      convo.send(text);
    },
    [convo],
  );

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
                  onClick={convo.correctFiche}
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
                {m.mail && (
                  <a href={m.mail} className="hp-cta hp-focus inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold">
                    <Mail size={15} aria-hidden /> {C.mailIt[lang]}
                  </a>
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
          {convo.typing && (
            <span className="hp-card mt-3 inline-flex h-9 items-center gap-1.5 rounded-2xl rounded-tl-md px-4" aria-label={C.typing[lang]}>
              <span className="tk-typing-dot" />
              <span className="tk-typing-dot [animation-delay:0.15s]" />
              <span className="tk-typing-dot [animation-delay:0.3s]" />
            </span>
          )}
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
