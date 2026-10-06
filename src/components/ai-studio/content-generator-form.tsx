"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { GENERATION_KINDS, PLATFORMS, type GenerationKind } from "@/lib/ai/generation/prompt";

export function ContentGeneratorForm({
  voices,
  providerLabel,
  dailyLimit,
}: {
  voices: { id: string; name: string; brandName: string | null }[];
  providerLabel: string;
  dailyLimit: number;
}) {
  const [kind, setKind] = useState<GenerationKind>("caption");
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]);
  const [language, setLanguage] = useState<"en" | "fr">("en");
  const [brandVoiceId, setBrandVoiceId] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; content: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!goal.trim()) {
      setError("Describe the goal or offer.");
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
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; title?: string; content?: string };
      if (!response.ok || !body.ok || !body.content) {
        setError(body.message ?? "The draft could not be generated.");
      } else {
        setResult({ title: body.title ?? "Draft", content: body.content });
      }
    } catch {
      setError("The draft could not be generated. Check your connection.");
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Generate a draft"
          subtitle={`Uses ${providerLabel}. Every result is saved as a draft labeled "AI generated" for review — nothing is published. Limit: ${dailyLimit} per workspace per day.`}
        />
        <CardBody>
          <form onSubmit={generate} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Content
              <select value={kind} onChange={(e) => setKind(e.target.value as GenerationKind)} className={field}>
                {Object.entries(GENERATION_KINDS).map(([value, item]) => (
                  <option key={value} value={value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Platform
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={field}>
                {PLATFORMS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Brand voice
              <select value={brandVoiceId} onChange={(e) => setBrandVoiceId(e.target.value)} className={field}>
                <option value="">No brand voice</option>
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}{voice.brandName ? ` · ${voice.brandName}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Language
              <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "fr")} className={field}>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600 sm:col-span-2">
              Goal / offer
              <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={500} placeholder="e.g. Promote this week's lunch special" className={field} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600 sm:col-span-2">
              Context (optional)
              <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={4} maxLength={2000} placeholder="Facts the draft must use: prices, dates, address…" className={field} />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {busy ? "Generating…" : "Generate draft"}
              </button>
              {error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : null}
            </div>
          </form>
        </CardBody>
      </Card>

      {result ? (
        <Card>
          <CardHeader title={result.title} subtitle="Saved as a draft · AI generated · review before use" />
          <CardBody className="space-y-3">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{result.content}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <Link href="/dashboard/ai-studio/saved" className="text-xs font-semibold text-emerald-700 hover:underline">
                View saved drafts
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
