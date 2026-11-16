/** Human-selected Studio metadata preview. No tenant, confidence, provider or policy fields accepted. */
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export type OrganizerPreviewRequest = {
  outputId: string;
  destinationProjectId: string;
};
export function parseOrganizerPreviewRequest(value: unknown): OrganizerPreviewRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length !== 2 || !keys.includes("outputId") || !keys.includes("destinationProjectId")) return null;
  if (typeof input.outputId !== "string" || !UUID.test(input.outputId) ||
    typeof input.destinationProjectId !== "string" || !UUID.test(input.destinationProjectId)) return null;
  if (input.outputId.toLowerCase() === input.destinationProjectId.toLowerCase()) return null;
  return { outputId: input.outputId, destinationProjectId: input.destinationProjectId };
}
