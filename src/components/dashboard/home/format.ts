export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

export function formatChangePct(current: number | null, previous: number | null): {
  label: string;
  tone: "up" | "down" | "flat";
} | null {
  if (current == null || previous == null) return null;
  if (previous === 0 && current === 0) return { label: "0%", tone: "flat" };
  if (previous === 0) return { label: "100%", tone: "up" };
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.abs(pct) >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  if (pct > 0.05) return { label: `${rounded}%`, tone: "up" };
  if (pct < -0.05) return { label: `${Math.abs(Number(rounded))}%`, tone: "down" };
  return { label: "0%", tone: "flat" };
}

export function formatChangePoints(current: number | null, previous: number | null): {
  label: string;
  tone: "up" | "down" | "flat";
} | null {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return { label: "0.0", tone: "flat" };
  return {
    label: Math.abs(delta).toFixed(1),
    tone: delta > 0 ? "up" : "down",
  };
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = Date.now() - then;
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    youtube: "YouTube",
    google_business: "Google",
    google_ads: "Google Ads",
    meta_ads: "Meta Ads",
    x: "X",
    threads: "Threads",
    pinterest: "Pinterest",
    internal_demo: "Internal",
    qmaps: "QMAPS",
  };
  return labels[platform] ?? platform.replaceAll("_", " ");
}

export const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  linkedin: "#0A66C2",
  tiktok: "#111111",
  youtube: "#FF0000",
  google_business: "#4285F4",
  google_ads: "#4285F4",
  meta_ads: "#0668E1",
  x: "#111111",
  threads: "#111111",
};
