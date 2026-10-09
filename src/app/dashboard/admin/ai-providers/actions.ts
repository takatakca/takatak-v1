"use server";

import { revalidatePath } from "next/cache";

import { OUTCOME_MESSAGES, providerEntry } from "@/lib/ai-providers/catalog";
import { checkSavedProviderKey, removeProviderKey, saveProviderKey } from "@/lib/ai-providers/store";
import { ServiceError } from "@/lib/services/service-error";
import { getPlatformAdminAccess } from "@/lib/security/platform-admin-access";

export type ProviderKeyActionState = { ok: null } | { ok: true; message: string } | { ok: false; error: string };

const PAGE = "/dashboard/admin/ai-providers";

/** Writes need a real platform owner/admin; the foundation demo is read-only. */
async function requireWriter(): Promise<{ profileId: string } | { error: string }> {
  const access = await getPlatformAdminAccess();
  if (access.mode !== "authorized") return { error: "Only a signed-in platform owner or admin can change AI provider keys." };
  return { profileId: access.profileId };
}

function providerFrom(formData: FormData): string | null {
  const provider = String(formData.get("provider") ?? "");
  return providerEntry(provider) ? provider : null;
}

function failure(error: unknown, fallback: string): ProviderKeyActionState {
  if (error instanceof ServiceError) return { ok: false, error: error.message };
  console.error("[ai-provider-keys] action failed");
  return { ok: false, error: fallback };
}

export async function saveProviderKeyAction(_prev: ProviderKeyActionState, formData: FormData): Promise<ProviderKeyActionState> {
  const writer = await requireWriter();
  if ("error" in writer) return { ok: false, error: writer.error };
  const provider = providerFrom(formData);
  if (!provider) return { ok: false, error: "Unknown AI provider." };

  try {
    await saveProviderKey({ provider, apiKey: formData.get("apiKey"), actorProfileId: writer.profileId });
  } catch (error) {
    return failure(error, "The key could not be saved. Try again.");
  }
  revalidatePath(PAGE);
  const checkable = providerEntry(provider)?.check.kind !== "none";
  return { ok: true, message: checkable ? "Saved. Run the test to confirm the key works." : "Saved." };
}

export async function checkProviderKeyAction(_prev: ProviderKeyActionState, formData: FormData): Promise<ProviderKeyActionState> {
  const writer = await requireWriter();
  if ("error" in writer) return { ok: false, error: writer.error };
  const provider = providerFrom(formData);
  if (!provider) return { ok: false, error: "Unknown AI provider." };

  try {
    const outcome = await checkSavedProviderKey({ provider, actorProfileId: writer.profileId });
    revalidatePath(PAGE);
    return outcome === "verified" ? { ok: true, message: OUTCOME_MESSAGES.verified } : { ok: false, error: OUTCOME_MESSAGES[outcome] };
  } catch (error) {
    return failure(error, "The test could not run. Try again.");
  }
}

export async function removeProviderKeyAction(_prev: ProviderKeyActionState, formData: FormData): Promise<ProviderKeyActionState> {
  const writer = await requireWriter();
  if ("error" in writer) return { ok: false, error: writer.error };
  const provider = providerFrom(formData);
  if (!provider) return { ok: false, error: "Unknown AI provider." };

  try {
    const removed = await removeProviderKey({ provider, actorProfileId: writer.profileId });
    revalidatePath(PAGE);
    return removed ? { ok: true, message: "Key removed." } : { ok: true, message: "No saved key to remove." };
  } catch (error) {
    return failure(error, "The key could not be removed. Try again.");
  }
}
