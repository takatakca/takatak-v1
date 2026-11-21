// Maps a TAK-TAK refusal to the AI Studio failure codes. Pure, so it is
// tested without a database or a network.
import type { StudioCallResult } from "./service";

export function studioFailureFromTakbot(code: string): Extract<StudioCallResult, { ok: false }>["code"] {
  switch (code) {
    case "insufficient_credits":
      return "insufficient_credits";
    case "no_engine_connected":
      return "no_engine";
    case "timeout":
    case "network":
    case "rate_limited":
    case "auth":
    case "empty":
      return code;
    default:
      return "provider_error";
  }
}

/** One prompt for the TAK-TAK relay: the AI Studio rules first, then the task. */
export function takbotStudioPrompt(prompt: { system: string; user: string }): string {
  return `${prompt.system}\n\n${prompt.user}`;
}
