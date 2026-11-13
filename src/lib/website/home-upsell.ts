// What to offer next once a service is in the plan: one service leads to the
// next ("pairs well with"), so the plan grows one click at a time. Opinion, not
// sales data: the wording never says "most bought" or "frequently bought".

import type { CategoryKey } from "./core-categories";

export const PAIRS_WITH: Record<CategoryKey, readonly CategoryKey[]> = {
  website: ["domains", "hosting", "local"],
  domains: ["hosting", "website"],
  hosting: ["domains", "website"],
  local: ["reviews", "social"],
  reviews: ["local", "social"],
  social: ["marketing", "ai"],
  marketing: ["social", "local", "ai"],
  ai: ["social", "marketing"],
  billing: ["website", "ai"],
  voip: ["billing", "website"],
};

/** The next services to suggest for this plan, in order, never ones already in it. */
export function nextSuggestions(keys: readonly CategoryKey[], from?: CategoryKey, limit = 2): CategoryKey[] {
  const seeds = from ? [from, ...keys.filter((k) => k !== from)] : [...keys].reverse();
  const out: CategoryKey[] = [];
  for (const seed of seeds) {
    for (const next of PAIRS_WITH[seed]) {
      if (!keys.includes(next) && !out.includes(next)) out.push(next);
      if (out.length >= limit) return out;
    }
  }
  if (!keys.length) out.push("website");
  return out.slice(0, limit);
}
