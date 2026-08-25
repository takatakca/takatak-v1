/** Local search catalog used for autocomplete and offline fallback. */
export type SearchKind =
  | "domain"
  | "hosting"
  | "service"
  | "marketplace_category"
  | "freelance"
  | "action";

export interface SearchEntry {
  id: string;
  title: string;
  kind: SearchKind;
  keywords: string[];
  to: string;
  description?: string;
  category?: string;
}

import { MARKETPLACE_CATEGORIES } from "./marketplace-categories";

export const SEARCH_CATALOG: SearchEntry[] = [
  { id: "domain-search", title: "Search & register a domain", kind: "domain", keywords: ["domain", "domains", ".com", ".ca", "register", "dns", "tld", "name"], to: "/domain" },
  { id: "hosting-plans", title: "Web hosting plans", kind: "hosting", keywords: ["hosting", "host", "cpanel", "wordpress", "server", "ssl", "litespeed"], to: "/hosting" },
  { id: "svc-websites", title: "Website creation", kind: "service", keywords: ["website", "site", "web", "design", "build", "wordpress"], to: "/services/websites" },
  { id: "svc-mobile", title: "Mobile app design", kind: "service", keywords: ["mobile", "app", "ios", "android", "react native"], to: "/services/mobile-apps" },
  { id: "svc-marketing", title: "Online marketing", kind: "service", keywords: ["marketing", "ads", "advertising", "google ads", "facebook ads", "ppc"], to: "/services/marketing" },
  { id: "svc-social", title: "Social media management", kind: "service", keywords: ["social", "instagram", "facebook", "tiktok", "content", "posts"], to: "/services/social-media" },
  { id: "svc-qmaps", title: "QMAPS — Local listings", kind: "service", keywords: ["qmaps", "local", "google maps", "listings", "gbp", "yelp", "seo local"], to: "/services/local-listings" },
  { id: "svc-flexs", title: "FLEXS — Lead generation", kind: "service", keywords: ["flexs", "leads", "lead generation", "prospects", "outreach"], to: "/services/lead-generation" },
  { id: "svc-voip", title: "VoIP business phone", kind: "service", keywords: ["voip", "phone", "calls", "sip", "business number"], to: "/services/voip" },
  { id: "svc-ai", title: "AI business tools", kind: "service", keywords: ["ai", "automation", "chatbot", "assistant", "openai", "gpt"], to: "/services/ai-business-tools" },
  ...MARKETPLACE_CATEGORIES.map((c) => ({
    id: `mkt-${c.slug}`,
    title: c.name,
    kind: "marketplace_category" as const,
    keywords: c.name.toLowerCase().split(/[\s&]+/),
    to: `/marketplace/category/${c.slug}`,
    category: c.slug,
  })),
  { id: "freelance-seo", title: "SEO services", kind: "freelance", keywords: ["seo", "search engine", "ranking", "keywords"], to: "/marketplace/category/seo_local_visibility" },
  { id: "freelance-content", title: "Content writing", kind: "freelance", keywords: ["content", "writing", "blog", "article", "copy", "copywriting"], to: "/marketplace/category/content_writing" },
  { id: "freelance-data", title: "Data entry", kind: "freelance", keywords: ["data entry", "spreadsheet", "excel", "typing"], to: "/marketplace/category/data_entry" },
  { id: "freelance-va", title: "Virtual assistance", kind: "freelance", keywords: ["virtual assistant", "va", "admin", "support"], to: "/marketplace/category/virtual_assistance" },
  { id: "freelance-menu", title: "Menu design", kind: "freelance", keywords: ["menu", "restaurant menu", "food menu"], to: "/marketplace/category/menu_design" },
  { id: "freelance-flyer", title: "Flyer design", kind: "freelance", keywords: ["flyer", "poster", "leaflet"], to: "/marketplace/category/flyer_design" },
  { id: "freelance-ecom", title: "Ecommerce setup", kind: "freelance", keywords: ["ecommerce", "shop", "shopify", "woocommerce", "store"], to: "/marketplace/category/ecommerce_setup" },
  { id: "action-post", title: "Post a custom project", kind: "action", keywords: ["custom", "project", "post", "freelancer", "hire"], to: "/marketplace/post-project" },
];

export function localSearch(q: string, category?: string): SearchEntry[] {
  const query = q.trim().toLowerCase();
  if (!query) return SEARCH_CATALOG.slice(0, 10);
  return SEARCH_CATALOG.filter((e) => {
    if (category && e.category !== category && e.kind !== "marketplace_category") return false;
    if (e.title.toLowerCase().includes(query)) return true;
    return e.keywords.some((k) => k.includes(query) || query.includes(k));
  }).slice(0, 20);
}

/** Heuristic: which "intent" does this query map to? */
export function classifyIntent(
  q: string,
): "domain" | "hosting" | "qmaps" | "flexs" | "freelance" | "service" | "unknown" {
  const s = q.toLowerCase();
  if (/\.(com|ca|net|org|io|app|co)\b/.test(s) || s.includes("domain")) return "domain";
  if (s.includes("host") || s.includes("cpanel") || s.includes("wordpress hosting")) return "hosting";
  if (/(qmaps|google maps|local listing|gbp|google business)/.test(s)) return "qmaps";
  if (/(flexs|lead gen|lead generation|prospect)/.test(s)) return "flexs";
  if (/(freelanc|custom|hire|gig|design|writer|writing|logo|data entry|virtual assistant)/.test(s)) return "freelance";
  return "service";
}