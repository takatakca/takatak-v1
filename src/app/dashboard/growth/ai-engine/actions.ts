"use server";

import { revalidatePath } from "next/cache";

import { grantCredits } from "@/lib/ai-credits/ledger";
import { getServerAccessContext } from "@/lib/security/access-context";

export type GrantState = { ok: null } | { ok: true; message: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Platform owners/admins only: add (or adjust) a client's AI credits. */
export async function grantCreditsAction(_prev: GrantState, formData: FormData): Promise<GrantState> {
  const { access } = await getServerAccessContext();
  if (access.mode !== "platform_admin") return { ok: false, error: "Only platform administrators can grant credits." };

  const clientId = String(formData.get("clientId") ?? "");
  const credits = Number(String(formData.get("credits") ?? "").trim());
  const reasonRaw = String(formData.get("reason") ?? "grant");
  const reason = reasonRaw === "purchase" || reasonRaw === "adjustment" ? reasonRaw : "grant";
  const nonce = String(formData.get("nonce") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 280) || null;

  if (!UUID.test(clientId)) return { ok: false, error: "Choose a client." };
  if (!Number.isInteger(credits) || credits === 0) return { ok: false, error: "Enter a whole number of credits." };
  if (credits < 0 && reason !== "adjustment") return { ok: false, error: "Use “Adjustment” to remove credits." };
  if (!UUID.test(nonce)) return { ok: false, error: "Reload the page and try again." };

  try {
    const result = await grantCredits({ clientId, credits, reason, idempotencyKey: nonce, note, actorProfileId: access.profileId });
    if (!result.ok) {
      const messages = {
        insufficient_credits: "That adjustment would make the balance negative.",
        unknown_client: "Client not found.",
        idempotency_conflict: "This form was already submitted. Reload the page.",
        invalid_request: "Invalid amount.",
      } as const;
      return { ok: false, error: messages[result.code] };
    }
    revalidatePath("/dashboard/growth/ai-engine");
    return {
      ok: true,
      message: result.replayed ? `Already applied. Balance: ${result.balance}.` : `Done. New balance: ${result.balance.toLocaleString("en-CA")} credits.`,
    };
  } catch {
    console.error("[ai-credits] grant failed");
    return { ok: false, error: "The ledger is unavailable. Try again." };
  }
}
