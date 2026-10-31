"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Coins, Sparkles } from "lucide-react";

import { homeV2 } from "@/lib/website/home-funnel";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

type Bi = { en: string; fr: string };

/** Scripted demo conversations (labelled "Demo" on screen; no engine is called). */
const SCENES: readonly { mode: Bi; engine: string; credits: number; prompt: Bi; answer: Bi }[] = [
  {
    mode: { en: "Write", fr: "Rédiger" },
    engine: "Anthropic Claude",
    credits: 2,
    prompt: { en: "Write 3 Instagram captions for our new weekend brunch.", fr: "Écris 3 légendes Instagram pour notre nouveau brunch du week-end." },
    answer: {
      en: "1. Saturday called. It wants eggs Benedict. 🍳\n2. Slow mornings, strong coffee, brunch until 2 pm.\n3. Your weekend plan is set: table for four?",
      fr: "1. Samedi a appelé. Il veut des œufs bénédictine. 🍳\n2. Matins lents, café corsé, brunch jusqu’à 14 h.\n3. Votre plan du week-end est réglé : une table pour quatre ?",
    },
  },
  {
    mode: { en: "Research", fr: "Rechercher" },
    engine: "Perplexity",
    credits: 2,
    prompt: { en: "What do customers praise most in Laval dental clinic reviews?", fr: "Qu’est-ce que les clients louangent le plus dans les avis des cliniques dentaires de Laval ?" },
    answer: {
      en: "Three themes repeat: gentle care with anxious patients, evening and Saturday hours, and clear prices before treatment. Lead your page with all three.",
      fr: "Trois thèmes reviennent : la douceur avec les patients anxieux, les heures de soir et du samedi, et des prix clairs avant le traitement. Mettez les trois en avant.",
    },
  },
  {
    mode: { en: "Chat", fr: "Clavarder" },
    engine: "Mistral",
    credits: 1,
    prompt: { en: "How should I answer a 2-star review about slow service?", fr: "Comment répondre à un avis 2 étoiles sur un service lent ?" },
    answer: {
      en: "Thank them, own the wait without excuses, say what changed (an extra server on Fridays), and invite them back by name. Keep it under 60 words.",
      fr: "Remerciez, assumez l’attente sans excuses, dites ce qui a changé (un serveur de plus le vendredi) et réinvitez la personne par son nom. Moins de 60 mots.",
    },
  },
];

const ENGINES = ["Anthropic Claude", "OpenAI", "Google Gemini", "Mistral", "Perplexity", "xAI Grok"];

type Phase = "typing" | "routing" | "answering" | "done";

/** A TAK bot window that types a prompt, routes it to an engine and streams the answer, in a loop. */
export function TakbotDemo() {
  const { lang } = useLanguage();
  const reduced = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState(0);
  const [streamed, setStreamed] = useState(0);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const s = SCENES[scene];
  const prompt = s.prompt[lang];
  const answer = s.answer[lang];

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) {
      setTyped(prompt.length);
      setStreamed(answer.length);
      setPhase("done");
      return;
    }
    if (!inView) return;
    let t = 0;
    if (phase === "typing") {
      if (typed < prompt.length) t = window.setTimeout(() => setTyped((n) => n + 1), 28);
      else t = window.setTimeout(() => setPhase("routing"), 450);
    } else if (phase === "routing") {
      t = window.setTimeout(() => setPhase("answering"), 1500);
    } else if (phase === "answering") {
      if (streamed < answer.length) t = window.setTimeout(() => setStreamed((n) => Math.min(answer.length, n + 3)), 18);
      else t = window.setTimeout(() => setPhase("done"), 200);
    } else {
      t = window.setTimeout(() => {
        setScene((n) => (n + 1) % SCENES.length);
        setTyped(0);
        setStreamed(0);
        setPhase("typing");
      }, 3600);
    }
    return () => window.clearTimeout(t);
  }, [phase, typed, streamed, prompt.length, answer.length, inView, reduced]);

  const routed = phase === "answering" || phase === "done";

  return (
    <div ref={rootRef} className="relative">
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#070F22]/90 shadow-[0_50px_120px_-40px_#1F8BFF] backdrop-blur-xl">
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </span>
          <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <Bot size={15} className="text-[#29C3FF]" aria-hidden /> TAK bot
          </span>
          <span className="ml-auto rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
            {homeV2.takbot.demo[lang]}
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_190px]">
          <div className="min-h-[340px] p-5">
            {/* Prompt */}
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-[#1F8BFF] px-4 py-3 text-[14.5px] leading-6 text-white">
              {prompt.slice(0, typed)}
              {phase === "typing" && <span className="tk-caret" />}
            </div>
            <p className="mt-2 text-right text-[11px] text-white/35">
              {s.mode[lang]} · Auto
            </p>

            {/* Answer */}
            {phase !== "typing" && (
              <div className="tk-slide-in mt-4 max-w-[94%] rounded-2xl rounded-tl-md border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                {phase === "routing" ? (
                  <p className="flex items-center gap-2 text-[13.5px] text-white/60">
                    <Sparkles size={14} className="animate-pulse text-[#29C3FF]" aria-hidden />
                    {homeV2.takbot.routing[lang]} → <span className="font-semibold text-white">{s.engine}</span>
                  </p>
                ) : (
                  <>
                    <p className="whitespace-pre-line text-[14.5px] leading-6 text-white/85">
                      {answer.slice(0, streamed)}
                      {phase === "answering" && <span className="tk-caret" />}
                    </p>
                    <p className="mt-3 flex items-center gap-3 border-t border-white/[0.07] pt-2 text-[11px] text-white/40">
                      <span>{s.engine}</span>
                      <span className="inline-flex items-center gap-1">
                        <Coins size={11} className="text-amber-200/80" aria-hidden /> {s.credits}
                      </span>
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Router */}
          <div className="hidden border-l border-white/[0.07] p-4 md:block">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/35">{homeV2.takbot.routing[lang]}</p>
            <ul className="mt-3 grid gap-1.5">
              {ENGINES.map((e) => {
                const hit = e === s.engine && phase !== "typing";
                return (
                  <li
                    key={e}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] transition-all duration-500 ${
                      hit ? "bg-[#1F8BFF]/20 text-white ring-1 ring-[#1F8BFF]/60" : "text-white/45"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-all ${hit ? (routed ? "bg-emerald-300 shadow-[0_0_10px_#6EE7B7]" : "animate-pulse bg-[#29C3FF]") : "bg-white/20"}`}
                      aria-hidden
                    />
                    {e.replace("Anthropic ", "").replace("Google ", "")}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
