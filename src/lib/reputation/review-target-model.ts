export type ReviewDraftSource = "google" | "qmaps" | "takatak";
export function canonicalReviewReply(
  source: ReviewDraftSource,
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;
  const text =
    source === "qmaps" ? value.trim().replace(/\s+/g, " ") : value.trim();
  const max = source === "qmaps" ? 2000 : 4000;
  return text.length >= 1 &&
    text.length <= max &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)
    ? text
    : null;
}

/** Version2 Review requests explicitly select a human approval workflow. */
export function reviewRequiresHumanApproval(
  agentKey: string,
  input: unknown,
): boolean {
  return (
    agentKey === "review_responder" &&
    !!input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    (input as Record<string, unknown>).reviewWorkflowVersion === 2
  );
}
