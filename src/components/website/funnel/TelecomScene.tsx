"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Hash,
  ListTree,
  MessageSquareText,
  Mic,
  Phone,
  PhoneForwarded,
  PhoneOff,
  Sparkles,
  Video,
  Voicemail,
  type LucideIcon,
} from "lucide-react";

import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { useSeen } from "./primitives";

type Lang = "fr" | "en";
type Bi = Record<Lang, string>;

interface Option {
  key: string;
  Icon: LucideIcon;
  title: Bi;
  detail: Bi;
  /** Desktop position around the phone, in % of the stage. */
  x: number;
  y: number;
}

const OPTIONS: Option[] = [
  { key: "number", Icon: Hash, title: { fr: "Numéro virtuel", en: "Virtual number" }, detail: { fr: "514, 438, 450, 418, 819…", en: "514, 438, 450, 418, 819…" }, x: 3, y: 6 },
  { key: "ivr", Icon: ListTree, title: { fr: "Standard automatique", en: "Auto attendant" }, detail: { fr: "1 Ventes · 2 Soutien · 3 Heures", en: "1 Sales · 2 Support · 3 Hours" }, x: 0, y: 32 },
  { key: "vm", Icon: Voicemail, title: { fr: "Boîte vocale → texte", en: "Voicemail → text" }, detail: { fr: "« Bonjour, je voudrais une soumission… »", en: "“Hi, I'd like a quote…”" }, x: 3, y: 58 },
  { key: "sms", Icon: MessageSquareText, title: { fr: "Textos et MMS", en: "Texts and MMS" }, detail: { fr: "Depuis votre numéro d'affaires", en: "From your business number" }, x: 6, y: 83 },
  { key: "video", Icon: Video, title: { fr: "Réunion vidéo", en: "Video meeting" }, detail: { fr: "4 personnes · lien invité", en: "4 people · guest link" }, x: 70, y: 4 },
  { key: "ai", Icon: Sparkles, title: { fr: "Réceptionniste IA", en: "AI receptionist" }, detail: { fr: "Répond, trie, prend le message", en: "Answers, sorts, takes the message" }, x: 74, y: 31 },
  { key: "forward", Icon: PhoneForwarded, title: { fr: "Renvoi d'appels", en: "Call forwarding" }, detail: { fr: "Vers votre cellulaire ou l'équipe", en: "To your cell or the team" }, x: 71, y: 58 },
  { key: "calendar", Icon: CalendarCheck, title: { fr: "Google Agenda", en: "Google Calendar" }, detail: { fr: "Appels et résumés dans l'agenda", en: "Calls and summaries in the calendar" }, x: 68, y: 83 },
];

const T = {
  demo: { fr: "Démonstration", en: "Demo" },
  incoming: { fr: "Appel entrant · Ligne Ventes", en: "Incoming call · Sales line" },
  live: { fr: "En ligne", en: "On the call" },
  caller: { fr: "Client", en: "Customer" },
  meet: { fr: "Réunion d'équipe", en: "Team meeting" },
} as const;

/** The phone at the centre and every MIMT option lighting up around it, one after the other. */
export function TelecomScene() {
  const { lang: l } = useLanguage();
  const lang = l as Lang;
  const reduced = useReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced || !seen) return;
    const t = window.setInterval(() => setStep((s) => s + 1), 1500);
    return () => window.clearInterval(t);
  }, [reduced, seen]);

  // First pass: options appear one by one; then one is highlighted at a time.
  const shown = reduced ? OPTIONS.length : Math.min(OPTIONS.length, step);
  const active = reduced ? -1 : step < OPTIONS.length ? step - 1 : (step - OPTIONS.length) % OPTIONS.length;
  const onCall = !reduced && step % 6 >= 3;
  const secs = (step % 6) * 2;

  return (
    <div ref={ref} className="relative">
      <span className="absolute bottom-0 left-1/2 z-[3] -translate-x-1/2 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60 lg:bottom-auto lg:top-[-6px]">{T.demo[lang]}</span>

      {/* Desktop stage: phone in the middle, options around it, light running along the wires */}
      <div className="relative hidden h-[560px] lg:block">
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {OPTIONS.map((o, i) => {
            const fromX = o.x < 50 ? 41 : 59;
            const toX = o.x < 50 ? o.x + 24 : o.x;
            const toY = o.y + 6;
            return (
              <path
                key={o.key}
                d={`M ${fromX} 50 C ${(fromX + toX) / 2} 50, ${(fromX + toX) / 2} ${toY}, ${toX} ${toY}`}
                fill="none"
                stroke={i === active ? "#29C3FF" : "rgb(255 255 255 / 0.14)"}
                strokeWidth={i === active ? 0.45 : 0.25}
                vectorEffect="non-scaling-stroke"
                className={i < shown ? "hp-wire" : "opacity-0"}
                style={{ transition: "stroke 0.4s ease, opacity 0.4s ease" }}
              />
            );
          })}
        </svg>
        <Handset lang={lang} onCall={onCall} secs={secs} reduced={reduced} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        {OPTIONS.map((o, i) => (
          <OptionCard key={o.key} o={o} lang={lang} shown={i < shown} active={i === active} style={{ left: `${o.x}%`, top: `${o.y}%` }} className="absolute w-[27%]" />
        ))}
      </div>

      {/* Mobile and tablet: phone, then the options in a grid */}
      <div className="lg:hidden">
        <Handset lang={lang} onCall={onCall} secs={secs} reduced={reduced} className="mx-auto" small />
        <div className="mt-6 grid grid-cols-2 gap-2.5 [&>*]:min-w-0">
          {OPTIONS.map((o, i) => (
            <OptionCard key={o.key} o={o} lang={lang} shown={i < shown || reduced} active={i === active} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionCard({ o, lang, shown, active, style, className = "" }: { o: Option; lang: Lang; shown: boolean; active: boolean; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      style={style}
      className={`${className} rounded-2xl p-3 backdrop-blur transition-all duration-500 ${
        shown ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
      } ${active ? "bg-[#1E6BFF]/25 shadow-[0_0_0_1px_rgb(41_195_255/0.7),0_18px_50px_-12px_rgb(41_195_255/0.6)]" : "bg-white/[0.05] ring-1 ring-white/10"}`}
    >
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? "bg-white text-[#0B3BFF]" : "bg-white/10 text-[#7FD8FF]"}`}>
          <o.Icon size={14} aria-hidden />
        </span>
        {o.title[lang]}
      </p>
      {o.key === "video" ? (
        <div className="mt-2 grid grid-cols-4 gap-1">
          {["MG", "JT", "SL", "AB"].map((n, i) => (
            <span
              key={n}
              className="grid aspect-square place-items-center rounded-md text-[10px] font-bold text-white"
              style={{ background: ["#1E6BFF", "#5B3DF5", "#0EA5E9", "#3C4BFF"][i] }}
            >
              {n}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 truncate text-[12px] text-white/60">{o.detail[lang]}</p>
      )}
    </div>
  );
}

function Handset({ lang, onCall, secs, reduced, className = "", small = false }: { lang: Lang; onCall: boolean; secs: number; reduced: boolean; className?: string; small?: boolean }) {
  return (
    <div className={`${className} relative ${small ? "w-[210px]" : "w-[230px]"}`}>
      {/* Rings */}
      {!reduced && !onCall && (
        <>
          <span aria-hidden className="absolute left-1/2 top-[38%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#29C3FF]/15" />
          <span aria-hidden className="absolute left-1/2 top-[38%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-[#29C3FF]/20" />
        </>
      )}
      <div className={`relative overflow-hidden rounded-[38px] border-[6px] border-[#1B2436] bg-[linear-gradient(170deg,#0B1B3F,#060D1F_60%)] shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_255_255/0.06)] ${small ? "h-[400px]" : "h-[460px]"}`}>
        <span aria-hidden className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="flex h-full flex-col items-center px-5 pb-6 pt-14 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7FD8FF]">MIMT</p>
          <p className="mt-2 text-[12.5px] text-white/60">{onCall ? T.live[lang] : T.incoming[lang]}</p>
          <span className="mt-6 grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(135deg,#1E6BFF,#29C3FF)] text-[24px] font-bold text-white shadow-[0_12px_40px_-8px_rgb(41_195_255/0.7)]">CL</span>
          <p className="mt-4 text-[18px] font-semibold text-white">{T.caller[lang]}</p>
          <p className="mt-1 text-[14px] tabular-nums text-white/60">514 555-0142</p>
          {onCall && <p className="mt-2 text-[13px] tabular-nums text-emerald-300">00:{String(secs).padStart(2, "0")}</p>}
          <div className="mt-auto flex w-full items-center justify-around">
            {onCall ? (
              <>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white">
                  <Mic size={18} aria-hidden />
                </span>
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#E5484D] text-white">
                  <PhoneOff size={20} aria-hidden />
                </span>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white">
                  <Video size={18} aria-hidden />
                </span>
              </>
            ) : (
              <>
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#E5484D] text-white">
                  <PhoneOff size={20} aria-hidden />
                </span>
                <span className={`grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white ${reduced ? "" : "animate-bounce"}`}>
                  <Phone size={20} aria-hidden />
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
