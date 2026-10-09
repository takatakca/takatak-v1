// The 9 TAKATAK core categories on the public website stay honest and complete.
// - every dynamic `cat.*` copy key exists in English and French;
// - the social networks and ad platforms named match the provider registry;
// - every price shown comes from the code catalogs; VoIP (planned) shows none;
// - capabilities the code does not run yet are labelled "coming soon".
// Run: npm run qa:website-categories
import assert from "node:assert/strict";

import { SOCIAL_PROVIDER_REGISTRY } from "../src/lib/social/providers/registry";
import { SOCIAL_PLAN_CATALOG } from "../src/lib/billing/social/plan-catalog";
import {
  AD_PLATFORMS_LIVE,
  CORE_CATEGORIES,
  NUMBERED_CATEGORIES,
  REPORTING_LIVE,
  SERVICE_SLUG_TO_CATEGORY,
  SOCIAL_NETWORKS_LIVE,
  SOCIAL_NETWORKS_SOON,
  type PriceTier,
} from "../src/lib/website/core-categories";
import { pricing } from "../src/lib/website/pricing";
import { getServicePage } from "../src/lib/website/service-pages";
import { en } from "../src/lib/website/translations/en";
import { fr } from "../src/lib/website/translations/fr";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const dicts = { en: en as Record<string, string>, fr: fr as Record<string, string> };

console.log("Website core categories");

check("the nine categories follow the owner's order, after the website", () => {
  assert.deepEqual(
    CORE_CATEGORIES.map((c) => c.key),
    ["website", "domains", "hosting", "marketing", "social", "local", "reviews", "ai", "billing", "voip"],
  );
  assert.deepEqual(NUMBERED_CATEGORIES.map((c) => c.index), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

check("every category copy key exists in English and French, and differs where it should", () => {
  const missing: string[] = [];
  const tierKeys = (tiers: readonly PriceTier[]) => tiers.flatMap((t) => [t.nameKey, ...t.detailKeys, ...(t.suffixKey ? [t.suffixKey] : [])]);
  for (const c of CORE_CATEGORIES) {
    const keys = [
      ...["name", "eyebrow", "headline", "promise", "h1", "h2", "h3"].map((f) => `cat.${c.key}.${f}`),
      ...c.included.flatMap((_, i) => [`cat.${c.key}.inc${i + 1}.t`, `cat.${c.key}.inc${i + 1}.d`]),
      ...Array.from({ length: c.steps }, (_, i) => [`cat.${c.key}.step${i + 1}.t`, `cat.${c.key}.step${i + 1}.d`]).flat(),
      ...Array.from({ length: c.faqs }, (_, i) => [`cat.${c.key}.faq${i + 1}.q`, `cat.${c.key}.faq${i + 1}.a`]).flat(),
      ...c.views.flatMap((v) => [`cat.${c.key}.view.${v.id}`, `cat.${c.key}.cap.${v.id}`, ...(v.image ? [`cat.${c.key}.alt.${v.id}`] : [])]),
      c.primary.labelKey,
      c.secondary.labelKey,
      `cat.avail.${c.availability}`,
      ...(typeof c.from === "object" ? [c.from.prefixKey] : []),
      ...(c.pricing.kind === "tiers" ? tierKeys(c.pricing.tiers) : []),
      ...(c.pricing.kind === "social" ? [...tierKeys(c.pricing.software), ...tierKeys(c.pricing.managed)] : []),
      ...(c.pricing.kind === "quote" && c.pricing.related ? tierKeys(c.pricing.related) : []),
    ];
    for (const key of keys) {
      for (const [lang, dict] of Object.entries(dicts)) {
        if (!dict[key]?.trim()) missing.push(`${lang}:${key}`);
      }
    }
  }
  assert.deepEqual(missing, [], `missing copy: ${missing.join(", ")}`);
  const untranslated = Object.keys(en).filter(
    (k) => (k.startsWith("cat.") && /\.(headline|promise)$/.test(k)) && dicts.en[k] === dicts.fr[k],
  );
  assert.deepEqual(untranslated, [], `French equals English: ${untranslated.join(", ")}`);
});

check("social networks named on the site are exactly the registry's connectable ones", () => {
  const defs = Object.values(SOCIAL_PROVIDER_REGISTRY);
  const notSocial = new Set(["Web", "Blog", ...AD_PLATFORMS_LIVE, ...REPORTING_LIVE]);
  const live = defs.filter((d) => d.implemented && d.connectable && !notSocial.has(d.label)).map((d) => d.label);
  const soon = defs.filter((d) => !d.implemented).map((d) => d.label);
  assert.deepEqual([...SOCIAL_NETWORKS_LIVE].sort(), live.sort());
  assert.deepEqual([...SOCIAL_NETWORKS_SOON].sort(), soon.sort());
  for (const label of [...AD_PLATFORMS_LIVE, ...REPORTING_LIVE]) {
    const def = defs.find((d) => d.label === label);
    assert.ok(def?.implemented && def.connectable, `${label} must be implemented and connectable`);
  }
});

check("every price comes from the code catalogs", () => {
  const catalog = new Set<number>([
    pricing.domain.register.amount,
    pricing.domain.transfer.amount,
    ...Object.values(pricing).flatMap((g) => (Array.isArray(g) ? g.map((t) => t.amount) : [])),
    ...Object.values(SOCIAL_PLAN_CATALOG).map((p) => p.displayMonthlyCad),
  ]);
  for (const c of CORE_CATEGORIES) {
    const tiers =
      c.pricing.kind === "tiers" ? c.pricing.tiers
      : c.pricing.kind === "social" ? [...c.pricing.software, ...c.pricing.managed]
      : c.pricing.kind === "quote" ? c.pricing.related ?? []
      : [];
    for (const t of tiers) {
      assert.ok(catalog.has(t.amount), `${c.key}: ${t.amount} is not in a catalog`);
      assert.match(t.source, /^src\/lib\/(website\/pricing|billing\/social\/plan-catalog)\.ts:\d+$/);
    }
    if (typeof c.from === "object") assert.ok(catalog.has(c.from.amount), `${c.key} from-price`);
  }
});

check("the business phone is planned: no price, every feature labelled coming soon", () => {
  const voip = CORE_CATEGORIES.find((c) => c.key === "voip")!;
  assert.equal(voip.availability, "planned");
  assert.equal(voip.pricing.kind, "planned");
  assert.equal(voip.from, "planned");
  assert.ok(voip.included.slice(0, 5).every((i) => i.soon));
  assert.equal(getServicePage("voip")?.packages.length, 0, "the /services index must not show a VoIP price");
  const copy = Object.entries(dicts).flatMap(([, d]) => Object.entries(d).filter(([k]) => k.startsWith("cat.voip.")).map(([, v]) => v));
  for (const banned of [/unlimited/i, /illimit/i, /\bfree\b/i, /gratuit/i, /download/i, /télécharg/i, /fongo/i, /textnow/i, /\$/]) {
    assert.ok(!copy.some((v) => banned.test(v)), `VoIP copy must not match ${banned}`);
  }
});

check("capabilities not live in the code are labelled", () => {
  const soon = (key: string) => CORE_CATEGORIES.find((c) => c.key === key)!.included.filter((i) => i.soon).length;
  assert.ok(soon("social") >= 1, "direct publishing is not implemented");
  assert.ok(soon("reviews") >= 2, "review requests and AI drafts are not implemented");
  assert.ok(soon("ai") >= 3, "AI Studio generation runs no provider yet");
});

check("every /services category slug has a service page entry (sitemap + static params)", () => {
  for (const slug of Object.keys(SERVICE_SLUG_TO_CATEGORY)) {
    assert.ok(getServicePage(slug), `service page for ${slug}`);
  }
  for (const c of CORE_CATEGORIES) {
    if (c.route.startsWith("/services/")) {
      assert.ok(getServicePage(c.route.slice("/services/".length)), `${c.route} must be a service page`);
    } else {
      assert.ok(["/domain", "/hosting"].includes(c.route), c.route);
    }
  }
});

console.log(`\n${passed} website category checks passed.`);
