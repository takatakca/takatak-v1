import type { Bi } from "./service-pages";

/**
 * Brands GROUPE TAKATAK owns and operates, shown on /ecosystem ("Our brands").
 *
 * Source of truth: the owner's portfolio registry in the knowledgeAI repository,
 * `registry/portfolio-registry-2026-10-06.json` (plus `projects/*.md` and
 * `docs/10-PORTFOLIO-DOMAINS-REPOS-2026-10-06.md`).
 *
 * Rule: list an entry only when that registry marks it as owned by GROUPE
 * TAKATAK AND live/active. Never add a brand, number or claim that is not in
 * the registry, and never list a client's brand here.
 *
 * Registry snapshot 2026-10-06: it has no ownership field, it describes itself
 * as "not a legal ownership registry", and every asset's `currentStatus` is
 * `UNKNOWN_NEEDS_AUDIT`. No entry qualifies yet, so this list is empty and the
 * page and its links stay hidden from visitors (see `hasOwnedBrands`). When the
 * registry confirms an entry (owner = GROUPE TAKATAK, status = active), add it
 * here; the page, footer link and homepage link appear automatically.
 */
export interface OwnedBrand {
  /** Stable id, e.g. the registry project name in kebab case. */
  id: string;
  /** Public brand name, exactly as the registry spells it. */
  name: string;
  /** One-line description, bilingual. */
  description: Bi;
  /** Public domain from the registry, without protocol (e.g. "example.ca"). */
  domain?: string;
  /** Registry evidence for this entry (file + field), for reviewers. */
  registryRef: string;
}

export const ownedBrands: readonly OwnedBrand[] = [];

export const hasOwnedBrands = ownedBrands.length > 0;
