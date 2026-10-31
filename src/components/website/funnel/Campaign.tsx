"use client";

import { useEffect, useState } from "react";

import { money } from "@/components/website/premium/ui";
import { CORE_CATEGORIES, type CategoryKey } from "@/lib/website/core-categories";
import { PROMO_CODE, PROMO_PERCENT } from "@/lib/website/promotions";
import { Ticker } from "./primitives";

export interface Campaign {
  code: string;
  percentOff: number;
  endsAt: string;
}

/** The soonest-ending time-limited campaign from the server catalog, or null (the default). */
export function useActiveCampaign(): Campaign | null {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/promotions/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { campaigns?: Campaign[] } | null) => {
        if (alive) setCampaign(data?.campaigns?.[0] ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return campaign;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

/**
 * Live countdown to the end of a real campaign. The server refuses the code
 * after `endsAt`, so the clock never lies; with no campaign it renders nothing.
 */
export function CampaignCountdown({ campaign, lang, className = "" }: { campaign: Campaign | null; lang: "en" | "fr"; className?: string }) {
  const now = useNow(Boolean(campaign));
  if (!campaign) return null;
  const left = Math.max(0, Date.parse(campaign.endsAt) - now);
  if (!left) return null;
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${d ? `${d} ${lang === "fr" ? "j" : "d"} ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
  return (
    <p role="timer" aria-live="off" className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-[var(--hp-cta)] px-4 py-2 text-[13.5px] font-semibold text-white ${className}`}>
      <span>
        −{campaign.percentOff} % · {lang === "fr" ? "code" : "code"} {campaign.code}
      </span>
      <span className="opacity-80">·</span>
      <span>
        {lang === "fr" ? "se termine dans" : "ends in"} <span className="tabular-nums">{clock}</span>
      </span>
    </p>
  );
}

/**
 * What the real FIRST10 welcome offer is worth on this plan: 10 % of the
 * priciest priced line, which is the most it can take off one first order.
 */
export function welcomeSaving(keys: readonly CategoryKey[]): { amount: number; on: CategoryKey } | null {
  let best: { amount: number; on: CategoryKey } | null = null;
  for (const key of keys) {
    const c = CORE_CATEGORIES.find((x) => x.key === key);
    if (!c || typeof c.from === "string") continue;
    const amount = Math.round(c.from.amount * PROMO_PERCENT) / 100;
    if (!best || amount > best.amount) best = { amount, on: key };
  }
  return best;
}

export function WelcomeSaving({
  keys,
  lang,
  serviceName,
  tone = "card",
}: {
  keys: readonly CategoryKey[];
  lang: "en" | "fr";
  serviceName: (key: CategoryKey) => string;
  tone?: "card" | "inline";
}) {
  const saving = welcomeSaving(keys);
  if (!saving) return null;
  const fmt = (n: number) => money(lang, Math.round(n * 100) / 100);
  return (
    <div className={tone === "card" ? "rounded-2xl border border-dashed border-[var(--hp-cta)] p-4" : ""}>
      <p className="hp-ink flex flex-wrap items-baseline gap-x-2 text-[14px] font-semibold">
        <span className="hp-accent">{PROMO_CODE}</span>
        {lang === "fr" ? "· jusqu’à" : "· up to"}
        <Ticker value={saving.amount} format={(n) => `−${fmt(n)}`} className="hp-display text-[22px]" />
      </p>
      <p className="hp-ink-2 mt-1 text-[12.5px]">
        {lang === "fr"
          ? `${PROMO_PERCENT} % sur votre premier service, par exemple ${serviceName(saving.on)}. Une offre par nouveau client.`
          : `${PROMO_PERCENT}% off your first service, for example ${serviceName(saving.on)}. One offer per new client.`}
      </p>
    </div>
  );
}
