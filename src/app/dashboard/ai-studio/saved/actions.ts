"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { commitSavedOutputHandoff } from "@/lib/ai/handoff";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { resolveDataScope } from "@/lib/security/data-scope";
import { isUuid } from "@/lib/validation/common";

export async function sendSavedOutputToApproval(formData: FormData) {
  const outputId = String(formData.get("outputId") ?? "").trim();
  if (!isUuid(outputId)) redirect("/dashboard/ai-studio/saved?handoff=refused");

  const { access } = await getServerAccessContext();
  const scope = await resolveDataScope(access);
  if (scope.kind !== "db") redirect("/dashboard/ai-studio/saved?handoff=unavailable");

  const prisma = getPrisma();
  if (!prisma) redirect("/dashboard/ai-studio/saved?handoff=unavailable");

  const profileId =
    access.mode === "client_scoped" || access.mode === "platform_admin" ? access.profileId : null;
  const result = await commitSavedOutputHandoff(prisma, {
    outputId,
    clientIds: scope.clientIds,
    profileId: profileId && isUuid(profileId) ? profileId : null,
  });

  if (result.code === "sent" || result.code === "already") {
    revalidatePath("/dashboard/ai-studio/saved");
    revalidatePath("/dashboard/ai-studio");
    revalidatePath("/dashboard/social/approvals");
  }
  redirect(`/dashboard/ai-studio/saved?handoff=${result.code}`);
}
