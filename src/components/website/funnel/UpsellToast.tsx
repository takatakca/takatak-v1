"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Plus, X } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { CORE_CATEGORIES, type CategoryKey } from "@/lib/website/core-categories";
import { SERVICE_MEDIA } from "@/lib/website/home-media";
import { useHomePlan } from "@/lib/website/home-plan";
import { nextSuggestions } from "@/lib/website/home-upsell";

const SHOW_MS = 9000;

/**
 * After each service is added, offer the one that pairs with it. Adding it
 * offers the next one: the plan grows one click at a time, never by surprise.
 */
export function UpsellToast() {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const prev = useRef<CategoryKey[] | null>(null);
  const [added, setAdded] = useState<CategoryKey | null>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const before = prev.current;
    prev.current = plan.keys;
    if (!before) return;
    const fresh = plan.keys.filter((k) => !before.includes(k));
    // One service added by hand: offer the next. Presets and "add all" stay quiet.
    setAdded(fresh.length === 1 ? fresh[0] : null);
  }, [plan.keys]);

  useEffect(() => {
    if (!added || hover || plan.orderOpen) return;
    const t = window.setTimeout(() => setAdded(null), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [added, hover, plan.orderOpen]);

  if (!added || plan.orderOpen) return null;
  const next = nextSuggestions(plan.keys, added, 1)[0];
  const nextCat = next ? CORE_CATEGORIES.find((c) => c.key === next) : undefined;
  const media = next ? SERVICE_MEDIA[next] : undefined;
  const price =
    nextCat && typeof nextCat.from !== "string"
      ? `${money(lang, nextCat.from.amount)}${cadenceSuffix(tk, nextCat.from.cadence)}`
      : nextCat
        ? tk(nextCat.from === "quote" ? "cat.onQuote" : "cat.planned")
        : "";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[150px] z-[45] flex justify-center px-3 sm:bottom-24">
      <div
        role="status"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="hp-raised tk-modal-in pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-3xl p-2.5 pl-3 ring-1 ring-[var(--hp-line)] sm:mr-36"
      >
        {media && (
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
            <Image src={media.photo} alt="" fill sizes="56px" className="object-cover" style={{ objectPosition: media.focus, transform: `scale(${media.zoom})` }} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="hp-ink-2 flex items-center gap-1.5 text-[12.5px] font-medium">
            <Check size={13} className="text-emerald-500" strokeWidth={3} aria-hidden />
            {tk(`cat.${added}.name`)} {lang === "fr" ? "ajouté" : "added"}
          </span>
          {nextCat && (
            <span className="hp-ink block truncate text-[14.5px] font-semibold">
              {lang === "fr" ? "Va bien avec" : "Pairs well with"} {tk(`cat.${next}.name`)} <span className="hp-ink-2 font-normal">· {price}</span>
            </span>
          )}
        </span>
        {next && (
          <button
            type="button"
            onClick={() => plan.toggle(next)}
            className="hp-cta hp-halo hp-focus inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold"
          >
            <Plus size={15} aria-hidden /> {lang === "fr" ? "Ajouter" : "Add"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setAdded(null)}
          aria-label={lang === "fr" ? "Fermer" : "Close"}
          className="hp-ink-3 hp-focus grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-[var(--hp-alt)]"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
