// Minimal, dependency-free HTML signal extraction for SEO checks.
// Pure functions: no network. Script/style/comment content is stripped
// before structural counts so markup inside them is not misread.

export type PageSignals = {
  title: string | null;
  metaDescription: string | null;
  metaRobots: string | null;
  canonical: string | null;
  viewport: boolean;
  lang: string | null;
  h1Count: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  ogTitle: boolean;
  ogImage: boolean;
  structuredData: boolean;
  internalLinks: string[];
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'",
  "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
};

function decode(text: string): string {
  return text
    .replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => {
      const code = parseInt(n, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d{1,6});/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const inner = tag.replace(/^<\s*[a-zA-Z0-9-]+/, "").replace(/\/?>$/, "");
  let match: RegExpExecArray | null;
  while ((match = re.exec(inner))) {
    const name = match[1].toLowerCase();
    if (!(name in attributes)) {
      attributes[name] = decode(match[2] ?? match[3] ?? match[4] ?? "");
    }
  }
  return attributes;
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

const SKIPPED_EXTENSIONS =
  /\.(?:jpe?g|png|gif|webp|svg|ico|pdf|zip|mp4|mp3|webm|css|js|json|xml|txt|docx?|xlsx?)$/i;

export function extractSignals(html: string, pageUrl: string): PageSignals {
  const structuredData = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json/i.test(html);

  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(cleaned);
  const title = titleMatch ? decode(titleMatch[1]) || null : null;

  let metaDescription: string | null = null;
  let metaRobots: string | null = null;
  let viewport = false;
  let ogTitle = false;
  let ogImage = false;
  for (const tag of tags(cleaned, "meta")) {
    const a = parseAttributes(tag);
    const key = (a.name ?? a.property ?? "").toLowerCase();
    const content = a.content ?? "";
    if (key === "description" && metaDescription === null) metaDescription = content || null;
    else if (key === "robots" && metaRobots === null) metaRobots = content.toLowerCase() || null;
    else if (key === "viewport" && content) viewport = true;
    else if (key === "og:title" && content) ogTitle = true;
    else if (key === "og:image" && content) ogImage = true;
  }

  let canonical: string | null = null;
  for (const tag of tags(cleaned, "link")) {
    const a = parseAttributes(tag);
    if ((a.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") && a.href) {
      canonical = a.href;
      break;
    }
  }

  const htmlTag = tags(cleaned, "html")[0];
  const lang = htmlTag ? parseAttributes(htmlTag).lang || null : null;

  const h1Count = tags(cleaned, "h1").length;

  const images = tags(cleaned, "img");
  const imagesMissingAlt = images.filter((tag) => !("alt" in parseAttributes(tag))).length;

  const base = new URL(pageUrl);
  const internal = new Set<string>();
  for (const tag of tags(cleaned, "a")) {
    const href = parseAttributes(tag).href;
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    let target: URL;
    try {
      target = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(target.protocol)) continue;
    if (target.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (SKIPPED_EXTENSIONS.test(target.pathname)) continue;
    target.hash = "";
    internal.add(target.toString());
    if (internal.size >= 200) break;
  }

  return {
    title,
    metaDescription,
    metaRobots,
    canonical,
    viewport,
    lang,
    h1Count,
    imagesTotal: images.length,
    imagesMissingAlt,
    ogTitle,
    ogImage,
    structuredData,
    internalLinks: [...internal],
  };
}

/** Sitemap <loc> entries (same site only, bounded). */
export function extractSitemapUrls(xml: string, siteHost: string, limit = 50): string[] {
  const host = siteHost.replace(/^www\./, "");
  const urls: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) && urls.length < limit) {
    try {
      const url = new URL(decode(match[1]));
      if (/^https?:$/.test(url.protocol) && url.hostname.replace(/^www\./, "") === host) {
        url.hash = "";
        urls.push(url.toString());
      }
    } catch {
      /* ignore malformed entries */
    }
  }
  return urls;
}

/** robots.txt facts for the "*" group: Sitemap lines and a full-site block. */
export function parseRobots(text: string): { sitemaps: string[]; blocksAll: boolean } {
  const sitemaps: string[] = [];
  let inStarGroup = false;
  let groupHasAgentsOnly = false;
  let blocksAll = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [fieldRaw, ...rest] = line.split(":");
    const field = fieldRaw.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (field === "sitemap" && value) sitemaps.push(value);
    else if (field === "user-agent") {
      if (!groupHasAgentsOnly) inStarGroup = false;
      groupHasAgentsOnly = true;
      if (value === "*") inStarGroup = true;
    } else {
      groupHasAgentsOnly = false;
      if (inStarGroup && field === "disallow" && value === "/") blocksAll = true;
    }
  }
  return { sitemaps, blocksAll };
}
