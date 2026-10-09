import { AHMV_PUBLIC_TEAM_ID_RE } from "./ahmv-team-feed";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function normalizeAhmvPublicTeamIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;

  const ids = value.filter(
    (item): item is string =>
      typeof item === "string" && AHMV_PUBLIC_TEAM_ID_RE.test(item),
  );

  if (ids.length !== value.length) return null;
  return [...new Set(ids)].sort();
}

export function withAhmvPublicTeamIds(
  metadata: unknown,
  teamIds: readonly string[],
): Record<string, unknown> {
  const root = record(metadata);
  const ahmv = record(root["ahmv"]);
  delete ahmv["publicTeamId"];
  ahmv["publicTeamIds"] = [...teamIds];
  root["ahmv"] = ahmv;
  return root;
}
