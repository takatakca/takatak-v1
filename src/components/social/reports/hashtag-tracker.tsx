"use client";

import Link from "next/link";
import { useState } from "react";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";

/**
 * Hashtag research on the TAK-TAK research engine (web search with sources).
 * It runs through /api/takbot/run for the active workspace and is billed in AI
 * credits at the research price; nothing is estimated from Meta data TAKATAK
 * does not have.
 */
export function HashtagTracker({ researchCredits }: { researchCredits: number }) {
  const fr = useDashboardLanguage() === "fr";
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; credits: boolean } | null>(null);

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    const clean = tag.trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!/^[\p{L}\p{N}_]{2,60}$/u.test(clean)) {
      setError({ text: fr ? "Entrez un mot-clic valide, par exemple #restaurantmontreal." : "Enter a valid hashtag, e.g. #restaurantmontreal.", credits: false });
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const prompt = [
      `Research the hashtag #${clean} on Instagram, X (Twitter), TikTok and Facebook as of today.`,
      "Report: (1) what the hashtag is used for and by whom, (2) how active it looks (recent posts, typical engagement) with the sources you used,",
      "(3) related hashtags worth using with it, (4) three concrete ideas for a local business to use it well.",
      "Cite your sources. If a number is not available from a source, say so instead of estimating it.",
      fr ? "Answer in Canadian French." : "Answer in English.",
    ].join(" ");
    try {
      const response = await fetch("/api/takbot/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "research", engine: "auto", prompt, requestId: `hashtag-${crypto.randomUUID()}` }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; text?: string; code?: string };
      if (response.ok && body.ok && body.text) {
        setResult(body.text);
      } else if (response.status === 402 || body.code === "insufficient_credits") {
        setError({ text: fr ? "Crédits IA insuffisants pour cette recherche." : "Not enough AI credits for this research.", credits: true });
      } else if (body.code === "no_engine_connected") {
        setError({ text: fr ? "Aucun moteur de recherche IA n’est branché pour le moment." : "No AI research engine is connected right now.", credits: false });
      } else {
        setError({ text: fr ? "La recherche n’a pas pu se faire ; aucun crédit n’est perdu, réessayez." : "The research could not run; no credit is lost, try again.", credits: false });
      }
    } catch {
      setError({ text: fr ? "Vérifiez votre connexion et réessayez." : "Check your connection and try again.", credits: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article id="hashtag" className="relative mt-5 overflow-hidden rounded-xl border border-[#e8eaed] bg-white">
      <div className="flex flex-col gap-3 px-8 py-6">
        <h2 className="text-[18px] font-semibold leading-snug text-[#2a2a2a]">
          {fr ? "Suivi de mots-clics" : "Hashtag Tracker"}
        </h2>
        <p className="max-w-[34rem] text-[13px] leading-5 text-[#8b919a]">
          {fr
            ? "Analysez l’usage d’un mot-clic sur Instagram, X, TikTok et Facebook : à quoi il sert, son activité avec sources, les mots-clics associés et des idées pour votre entreprise."
            : "Analyze how a hashtag is used on Instagram, X, TikTok and Facebook: what it is for, its activity with sources, related hashtags and ideas for your business."}
        </p>
        <p className="text-[14px] font-semibold text-[#2a2a2a]">
          {researchCredits} {fr ? `crédit${researchCredits > 1 ? "s" : ""} IA par analyse` : `AI credit${researchCredits > 1 ? "s" : ""} per analysis`}
        </p>
        <form onSubmit={analyze} className="flex flex-wrap items-center gap-2">
          <input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            maxLength={61}
            placeholder={fr ? "#motclic" : "#hashtag"}
            aria-label={fr ? "Mot-clic à analyser" : "Hashtag to analyze"}
            className="h-9 w-60 rounded-md border border-[#d8dee4] px-3 text-[13px] outline-none focus:border-[#566DF1]"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 items-center justify-center rounded-md bg-[#2a1728] px-4 text-[13px] font-semibold text-white transition hover:bg-[#3b2438] disabled:opacity-60"
          >
            {busy ? (fr ? "Analyse…" : "Analyzing…") : fr ? "Analyser" : "Analyze"}
          </button>
        </form>
        {error ? (
          <p role="alert" className="text-[13px] text-rose-700">
            {error.text}{" "}
            {error.credits ? (
              <Link href="/dashboard/growth/ai-engine" className="font-semibold underline">
                {fr ? "Moteur IA et crédits" : "AI Engine & Credits"}
              </Link>
            ) : null}
          </p>
        ) : null}
        {result ? (
          <div className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-[#f5fafd] p-4 text-[13px] leading-6 text-slate-800 ring-1 ring-slate-200">
            {result}
          </div>
        ) : null}
      </div>
    </article>
  );
}
