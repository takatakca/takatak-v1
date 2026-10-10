// TK-022 — Score history for on-page audits. Stores a summary, never the HTML.

export const SEO_SCORE_ACTION = "seo.score";
export const REAUDIT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_REAUDIT_PER_RUN = 3;

export interface SeoCheckSnapshot {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface SeoScoreSnapshot {
  id: string;
  url: string;
  score: number;
  auditedAt: string;
  title: string | null;
  checks: SeoCheckSnapshot[];
}

export interface SeoScoreInput {
  requestedUrl: string;
  score: number;
  auditedAt: string;
  facts: { title: string | null };
  checks: Array<{ id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }>;
}

const STATUSES = new Set(["pass", "warn", "fail"]);

export function auditKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`.slice(0, 500);
  } catch {
    return url.trim().slice(0, 500);
  }
}

export function isDue(auditedAt: string, now: Date): boolean {
  const then = Date.parse(auditedAt);
  if (!Number.isFinite(then)) return false;
  return now.getTime() - then >= REAUDIT_AFTER_MS;
}

export function latestByUrl(rows: SeoScoreSnapshot[]): SeoScoreSnapshot[] {
  const map = new Map<string, SeoScoreSnapshot>();
  const sorted = [...rows].sort((a, b) => a.auditedAt.localeCompare(b.auditedAt));
  for (const row of sorted) {
    const key = auditKey(row.url);
    const current = map.get(key);
    if (!current || row.auditedAt >= current.auditedAt) map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.auditedAt.localeCompare(a.auditedAt));
}

export function dueUrls(rows: SeoScoreSnapshot[], now: Date): string[] {
  return latestByUrl(rows)
    .filter((row) => isDue(row.auditedAt, now))
    .sort((a, b) => a.auditedAt.localeCompare(b.auditedAt))
    .slice(0, MAX_REAUDIT_PER_RUN)
    .map((row) => row.url);
}

export function parseSeoScore(id: string, metadata: unknown): SeoScoreSnapshot | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const row = metadata as Record<string, unknown>;
  if (typeof row.url !== "string" || !row.url) return null;
  if (typeof row.score !== "number" || !Number.isInteger(row.score) || row.score < 0 || row.score > 100) return null;
  if (typeof row.auditedAt !== "string" || !Number.isFinite(Date.parse(row.auditedAt))) return null;
  const checks: SeoCheckSnapshot[] = [];
  if (Array.isArray(row.checks)) {
    for (const item of row.checks) {
      if (!item || typeof item !== "object") continue;
      const check = item as Record<string, unknown>;
      if (typeof check.id !== "string" || typeof check.label !== "string" || typeof check.detail !== "string") continue;
      if (typeof check.status !== "string" || !STATUSES.has(check.status)) continue;
      checks.push({
        id: check.id.slice(0, 40),
        label: check.label.slice(0, 80),
        status: check.status as SeoCheckSnapshot["status"],
        detail: check.detail.slice(0, 240),
      });
    }
  }
  return {
    id,
    url: auditKey(row.url),
    score: row.score,
    auditedAt: row.auditedAt,
    title: typeof row.title === "string" ? row.title.slice(0, 180) : null,
    checks,
  };
}

export function snapshotMetadata(input: SeoScoreInput): {
  url: string;
  score: number;
  auditedAt: string;
  title: string | null;
  checks: SeoCheckSnapshot[];
} | null {
  const parsed = parseSeoScore("new", {
    url: input.requestedUrl,
    score: input.score,
    auditedAt: input.auditedAt,
    title: input.facts.title,
    checks: input.checks,
  });
  if (!parsed) return null;
  return {
    url: parsed.url,
    score: parsed.score,
    auditedAt: parsed.auditedAt,
    title: parsed.title,
    checks: parsed.checks,
  };
}

const STATUS_FR: Record<SeoCheckSnapshot["status"], string> = {
  pass: "OK",
  warn: "À revoir",
  fail: "À corriger",
};

export function whiteLabelLines(snapshot: SeoScoreSnapshot, preparedFor: string): string[] {
  let host = snapshot.url;
  try {
    host = new URL(snapshot.url).host;
  } catch {
    host = snapshot.url;
  }
  const who = preparedFor.replace(/\s+/g, " ").trim().slice(0, 80) || "Client";
  const lines = [
    "Rapport SEO",
    `Préparé pour : ${who}`,
    `Site : ${host}`,
    `Adresse : ${snapshot.url}`.slice(0, 110),
    `Score : ${snapshot.score} / 100`,
    `Date : ${snapshot.auditedAt.slice(0, 10)}`,
    snapshot.title ? `Titre : ${snapshot.title}`.slice(0, 110) : "Titre : (aucun)",
    "",
    "Contrôles",
  ];
  for (const check of snapshot.checks.slice(0, 28)) {
    lines.push(`[${STATUS_FR[check.status]}] ${check.label}`.slice(0, 110));
    if (check.detail) lines.push(`  ${check.detail}`.slice(0, 110));
  }
  lines.push("");
  lines.push("Document client. Le HTML de la page n'est pas inclus.");
  return lines;
}
