// Prompts for the native agent runner. Pure functions, so they are tested
// without a database. Every prompt forbids inventing facts, prices or
// promotions: the business's own instructions and the run's input are the
// only sources.

export const NATIVE_AGENT_KEYS = new Set(["chat_concierge", "social_autopilot"] as const);
export type NativeAgentKey = "chat_concierge" | "social_autopilot";

export function isNativeAgent(key: string): key is NativeAgentKey {
  return (NATIVE_AGENT_KEYS as Set<string>).has(key);
}

/** TAK-TAK mode (and so the credit price) used for each agent. */
export function nativeMode(agentKey: NativeAgentKey): "chat" | "write" {
  return agentKey === "chat_concierge" ? "chat" : "write";
}

const clip = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

const RULES =
  "Rules: use only facts given here or in the business instructions. Never invent prices, hours, availability, promotions, discounts or reviews. If a fact is missing, say a team member will confirm it.";

export function buildAgentPrompt(
  agentKey: NativeAgentKey,
  context: { businessName: string; instructions: string | null; input: Record<string, unknown> },
): string {
  const business = clip(context.businessName, 80) || "the business";
  const instructions = clip(context.instructions, 1500);
  const brief = clip(context.input.brief, 2000);
  const lines: string[] = [];

  if (agentKey === "chat_concierge") {
    const message = clip(context.input.message, 2000);
    lines.push(
      `You answer the website chat for ${business}.`,
      `A visitor wrote: "${message}"`,
      "Write one short, warm and useful reply (90 words at most), in the visitor's language (French or English).",
      "Offer to pass the conversation to a person when you cannot fully answer.",
      RULES,
    );
  } else {
    lines.push(
      `You are the social media assistant of ${business}.`,
      "Write the posts for the coming week: one per day, 7 posts.",
      "For each post give: the day, a caption of 220 characters at most, 3 to 5 hashtags, and the best network (Facebook, Instagram or Google Business).",
      "Write each caption in Canadian French, then its English version on the next line.",
      RULES,
    );
  }
  if (brief) lines.push(`Brief from the business: ${brief}`);
  if (instructions) lines.push(`Standing instructions from the business: ${instructions}`);
  lines.push("Reply with the text only, no preamble.");
  return lines.join("\n");
}
