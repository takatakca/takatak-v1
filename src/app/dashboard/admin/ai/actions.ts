"use server";

import { revalidatePath } from "next/cache";

import { nativeRunnerEnabled, runNativeAgentBatch } from "@/lib/ai-agents/native-runner";
import { getPlatformAdminAccess } from "@/lib/security/platform-admin-access";

export type RunAgentsState = { ok: null } | { ok: true; message: string } | { ok: false; error: string };

/** Owner button: process the agent runs waiting now, without waiting for the scheduler. */
export async function runWaitingAgentsAction(_prev: RunAgentsState, _formData: FormData): Promise<RunAgentsState> {
  const access = await getPlatformAdminAccess();
  if (access.mode !== "authorized") return { ok: false, error: "Only a signed-in platform owner or admin can run agents." };
  if (!nativeRunnerEnabled()) return { ok: false, error: "The AI Gateway is configured: it runs the agents." };
  try {
    const results = await runNativeAgentBatch({ max: 3 });
    revalidatePath("/dashboard/admin/ai");
    if (!results.length) return { ok: true, message: "No agent run was waiting." };
    const summary = results.map((result) => `${result.agentKey}: ${result.outcome}`).join(" · ");
    return { ok: true, message: `${results.length} run(s) processed. ${summary}` };
  } catch {
    console.error("[admin-ai] run agents failed");
    return { ok: false, error: "The runs could not be processed. Try again in a minute." };
  }
}
