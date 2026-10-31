"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { CategoryIcon, useCopy } from "@/components/website/premium/ui";
import { CORE_CATEGORIES, type CategoryKey } from "@/lib/website/core-categories";
import { readStoredPlan } from "@/lib/website/home-plan";

/** On /register: the plan the visitor built on the homepage, so the flow never loses it. */
export function PlanCarryOver() {
  const { tk, lang } = useCopy();
  const [keys, setKeys] = useState<CategoryKey[]>([]);

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("plan")?.split(",") ?? [];
    const valid = fromQuery.filter((k): k is CategoryKey => CORE_CATEGORIES.some((c) => c.key === k));
    setKeys(valid.length ? valid : readStoredPlan());
  }, []);

  if (!keys.length) return null;
  const cats = CORE_CATEGORIES.filter((c) => keys.includes(c.key));
  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Check size={15} className="text-primary" aria-hidden />
        {lang === "fr" ? "Votre forfait est prêt. Créez votre compte pour le démarrer." : "Your plan is ready. Create your account to start it."}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {cats.map((c) => (
          <li key={c.key} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 pr-3 text-xs font-medium text-foreground">
            <CategoryIcon category={c} size={22} />
            {tk(`cat.${c.key}.name`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
