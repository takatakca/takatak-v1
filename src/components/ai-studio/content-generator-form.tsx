"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { GENERATION_KINDS, PLATFORMS, type GenerationKind } from "@/lib/ai/generation/prompt";

/**
 * One AI Studio draft form, used by the content generator, the campaign
 * builder and the video ideas screen (each passes its own content kinds).
 * French first, English alongside. Every result is a draft for review.
 */
export function ContentGeneratorForm({
  voices,
  engineLabel,
  dailyLimit,
  kinds,
  title = "Créer un brouillon · Generate a draft",
  goalLabel = "Objectif ou offre · Goal / offer",
  goalPlaceholder = "ex. : promouvoir le spécial du midi · e.g. promote this week's lunch special",
  contextPlaceholder = "Les faits à utiliser : prix, dates, adresse… · Facts the draft must use: prices, dates, address…",
  creditsPerDraft = null,
  initialBalance = null,
  trialCredits = null,
}: {
  voices: { id: string; name: string; brandName: string | null }[];
  engineLabel: string;
  dailyLimit: number;
  kinds?: readonly GenerationKind[];
  title?: string;
  goalLabel?: string;
  goalPlaceholder?: string;
  contextPlaceholder?: string;
  /** Credits one draft costs on the TAK-TAK engines; null when no credits are used. */
  creditsPerDraft?: number | null;
  initialBalance?: number | null;
  /** Free TAK-TAK trial credits this workspace can still claim, or null. */
  trialCredits?: number | null;
}) {
  const choices = kinds && kinds.length ? kinds : (Object.keys(GENERATION_KINDS) as GenerationKind[]);
  const [kind, setKind] = useState<GenerationKind>(choices[0]);
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]);
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const [brandVoiceId, setBrandVoiceId] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; noCredits: boolean } | null>(null);
  const [result, setResult] = useState<{ title: string; content: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(initialBalance);
  const [copied, setCopied] = useState(false);
  const [trialOpen, setTrialOpen] = useState(trialCredits !== null);
  const [claiming, setClaiming] = useState(false);

  async function claimTrial() {
    setClaiming(true);
    try {
      const response = await fetch("/api/takbot/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "fr", sourcePage: window.location.pathname }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; balance?: number };
      if (response.ok && body.ok) {
        if (typeof body.balance === "number") setBalance(body.balance);
        setTrialOpen(false);
        setError(null);
      } else {
        setError({ message: "Les crédits d’essai ne sont pas disponibles pour le moment. · Trial credits are not available right now.", noCredits: true });
        setTrialOpen(false);
      }
    } catch {
      setError({ message: "Vérifiez votre connexion. · Check your connection.", noCredits: false });
    } finally {
      setClaiming(false);
    }
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!goal.trim()) {
      setError({ message: "Décrivez l’objectif ou l’offre. · Describe the goal or offer.", noCredits: false });
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const response = await fetch("/api/ai-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, platform, language, brandVoiceId: brandVoiceId || null, goal, context }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        title?: string;
        content?: string;
        balance?: number | null;
      };
      if (typeof body.balance === "number") setBalance(body.balance);
      if (!response.ok || !body.ok || !body.content) {
        setError({
          message: body.message ?? "Le brouillon n’a pas pu être créé. · The draft could not be generated.",
          noCredits: response.status === 402,
        });
      } else {
        setResult({ title: body.title ?? "Brouillon · Draft", content: body.content });
      }
    } catch {
      setError({ message: "Le brouillon n’a pas pu être créé ; vérifiez votre connexion. · Check your connection.", noCredits: false });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";
  const cost =
    creditsPerDraft !== null
      ? ` ${creditsPerDraft} crédit${creditsPerDraft > 1 ? "s" : ""} IA par brouillon, remboursé${creditsPerDraft > 1 ? "s" : ""} si le moteur échoue · ${creditsPerDraft} AI credit${creditsPerDraft > 1 ? "s" : ""} per draft, refunded if the engine fails.`
      : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={title}
          subtitle={`${engineLabel}. Chaque résultat est gardé comme brouillon « généré par IA » à relire ; rien n’est publié · Every result is saved as an AI-generated draft for review; nothing is published. Maximum ${dailyLimit} par jour · per day.${cost}`}
        />
        <CardBody>
          {trialOpen && trialCredits !== null && creditsPerDraft !== null && (balance ?? 0) < creditsPerDraft ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              <span>
                Essayez gratuitement : {trialCredits} crédits d’essai offerts à votre espace, une seule fois · Try it free: {trialCredits} trial credits for your workspace, once.
              </span>
              <button
                type="button"
                onClick={claimTrial}
                disabled={claiming}
                className="rounded-lg bg-sky-700 px-3 py-1.5 font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
              >
                {claiming ? "…" : "Obtenir mes crédits · Get my credits"}
              </button>
            </div>
          ) : null}
          <form onSubmit={generate} className="grid gap-3 sm:grid-cols-2">
            {choices.length > 1 ? (
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Contenu · Content
                <select value={kind} onChange={(e) => setKind(e.target.value as GenerationKind)} className={field}>
                  {choices.map((value) => (
                    <option key={value} value={value}>
                      {GENERATION_KINDS[value].labelFr} · {GENERATION_KINDS[value].label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Plateforme · Platform
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={field}>
                {PLATFORMS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Voix de marque · Brand voice
              <select value={brandVoiceId} onChange={(e) => setBrandVoiceId(e.target.value)} className={field}>
                <option value="">Aucune · None</option>
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}{voice.brandName ? ` · ${voice.brandName}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Langue · Language
              <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "fr")} className={field}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600 sm:col-span-2">
              {goalLabel}
              <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={500} placeholder={goalPlaceholder} className={field} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600 sm:col-span-2">
              Contexte (facultatif) · Context (optional)
              <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={4} maxLength={2000} placeholder={contextPlaceholder} className={field} />
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {busy ? "Création… · Generating…" : "Créer le brouillon · Generate draft"}
              </button>
              {creditsPerDraft !== null && balance !== null ? (
                <span className="text-xs text-slate-500">Solde · Balance : {balance} crédit{balance > 1 ? "s" : ""}</span>
              ) : null}
              {error ? (
                <p role="alert" className="text-xs text-rose-700">
                  {error.message}{" "}
                  {error.noCredits ? (
                    <Link href="/dashboard/growth/ai-engine" className="font-semibold underline">
                      Moteur IA et crédits · AI Engine &amp; Credits
                    </Link>
                  ) : null}
                </p>
              ) : null}
            </div>
          </form>
        </CardBody>
      </Card>

      {result ? (
        <Card>
          <CardHeader title={result.title} subtitle="Gardé comme brouillon · généré par IA · à relire · Saved as a draft · AI generated · review before use" />
          <CardBody className="space-y-3">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{result.content}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copié · Copied" : "Copier · Copy"}
              </button>
              <Link href="/dashboard/ai-studio/saved" className="text-xs font-semibold text-emerald-700 hover:underline">
                Voir les brouillons · View saved drafts
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
