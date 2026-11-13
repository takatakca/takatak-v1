"use server";

import { revalidatePath } from "next/cache";
import {
  clientHasGrowthFeature,
  FEATURE_UPSELL,
} from "@/lib/billing/growth/entitlements";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { importReviewedReviews } from "@/lib/reputation/import-service";

export type ReviewImportState =
  | { ok: null }
  | { ok: false; error: string }
  | { ok: true; created: number; skipped: number };
export async function importReviewedReviewsAction(
  _previous: ReviewImportState,
  formData: FormData,
): Promise<ReviewImportState> {
  const { access } = await getServerAccessContext();
  if (
    access.mode !== "client_scoped" ||
    !hasEffectivePermission(access, "manage_reputation")
  )
    return {
      ok: false,
      error: "You cannot import reviews for this workspace.",
    };
  if (!(await clientHasGrowthFeature(access.activeClientId, "reputation")))
    return { ok: false, error: FEATURE_UPSELL.reputation };
  if (formData.get("confirmed") !== "on")
    return {
      ok: false,
      error: "Confirm that you are authorized to import these reviews.",
    };
  const raw = formData.get("payload");
  if (
    typeof raw !== "string" ||
    new TextEncoder().encode(raw).length > 128 * 1024
  )
    return { ok: false, error: "Import must be smaller than 128 KB." };
  try {
    const result = await importReviewedReviews(
      access.activeClientId,
      access.profileId,
      JSON.parse(raw),
    );
    if (result.ok) revalidatePath("/dashboard/growth/reviews");
    return result;
  } catch {
    return {
      ok: false,
      error:
        "The import could not be saved. No automatic provider connection was created.",
    };
  }
}
