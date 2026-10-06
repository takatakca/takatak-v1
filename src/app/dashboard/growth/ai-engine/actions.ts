"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseScheduleInput } from "@/lib/ai-agents/schedule";
import { cancelAgentRun, decideAgentRun, requestAgentRun, saveAgentSetting } from "@/lib/ai-agents/service";
import { grantCredits } from "@/lib/ai-credits/ledger";
import { aiCreditsCheckoutEnabled, startCreditCheckout } from "@/lib/billing/ai-credits/stripe";
import { clientHasGrowthFeature, FEATURE_UPSELL } from "@/lib/billing/growth/entitlements";
import { publicAppOrigin } from "@/lib/growth/public-origin";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

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

/** Workspace billing managers buy a credit pack through Stripe Checkout. */
export async function buyCreditsAction(formData: FormData): Promise<void> {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, "manage_settings") || !aiCreditsCheckoutEnabled()) {
    redirect("/dashboard/growth/ai-engine?credits=unavailable");
  }
  let url: string;
  try {
    url = await startCreditCheckout({
      clientId: access.activeClientId,
      packKey: String(formData.get("packKey") ?? ""),
      origin: await publicAppOrigin(),
    });
  } catch {
    console.error("[ai-credits] checkout failed");
    redirect("/dashboard/growth/ai-engine?credits=error");
  }
  redirect(url);
}

const AGENT_PATH = "/dashboard/growth/ai-engine";

async function scoped(permission: "manage_settings" | "create_content" | "approve_content") {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, permission)) return null;
  return access;
}

export async function saveAgentSettingAction(formData: FormData): Promise<void> {
  const access = await scoped("manage_settings");
  if (!access) return;
  const enabling = formData.get("enabled") === "on";
  if (enabling && !(await clientHasGrowthFeature(access.activeClientId, "ai_autopilot"))) return;
  await saveAgentSetting(access.activeClientId, String(formData.get("agentKey") ?? ""), {
    enabled: formData.get("enabled") === "on",
    requireApproval: formData.get("requireApproval") === "on",
    instructions: String(formData.get("instructions") ?? ""),
    schedule: parseScheduleInput({
      schedule: formData.get("schedule"),
      weekday: formData.get("scheduleWeekday"),
      hour: formData.get("scheduleHour"),
    }),
  });
  revalidatePath(AGENT_PATH);
}

export type RunRequestState = { ok: null } | { ok: true; message: string } | { ok: false; error: string };

export async function requestAgentRunAction(_prev: RunRequestState, formData: FormData): Promise<RunRequestState> {
  const access = await scoped("create_content");
  if (!access) return { ok: false, error: "You do not have permission to start agents." };
  if (!(await clientHasGrowthFeature(access.activeClientId, "ai_autopilot"))) return { ok: false, error: FEATURE_UPSELL.ai_autopilot };
  try {
    const result = await requestAgentRun(
      access.activeClientId,
      String(formData.get("agentKey") ?? ""),
      { trigger: "manual", brief: String(formData.get("brief") ?? "") },
      access.profileId,
    );
    if (!result.ok) {
      const messages = {
        unknown_agent: "Unknown agent.",
        agent_disabled: "Turn this agent on first.",
        already_pending: "This agent already has a run in progress.",
        plan_required: FEATURE_UPSELL.ai_autopilot,
      } as const;
      return { ok: false, error: messages[result.error] };
    }
  } catch {
    console.error("[ai-agents] request failed");
    return { ok: false, error: "The run could not be queued. Try again." };
  }
  revalidatePath(AGENT_PATH);
  return { ok: true, message: "Queued. The AI Gateway picks it up on its next pass." };
}

export async function decideAgentRunAction(formData: FormData): Promise<void> {
  const access = await scoped("approve_content");
  const runId = String(formData.get("runId") ?? "");
  if (!access || !UUID.test(runId)) return;
  await decideAgentRun(access.activeClientId, runId, formData.get("decision") === "approve", access.profileId);
  revalidatePath(AGENT_PATH);
}

export async function cancelAgentRunAction(formData: FormData): Promise<void> {
  const access = await scoped("create_content");
  const runId = String(formData.get("runId") ?? "");
  if (!access || !UUID.test(runId)) return;
  await cancelAgentRun(access.activeClientId, runId);
  revalidatePath(AGENT_PATH);
}
