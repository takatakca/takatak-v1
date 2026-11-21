"use server";

import { revalidatePath } from "next/cache";

import { getPrisma } from "@/lib/db/prisma";
import { asDashboardLanguage } from "@/lib/dashboard/nav-fr";
import { getServerAccessContext } from "@/lib/security/access-context";

/**
 * Switches the signed-in person's own dashboard language (the same setting as
 * Account settings › Preferences). Only "en" and "fr" are accepted; only the
 * caller's own profile row is changed.
 */
export async function setDashboardLanguageAction(formData: FormData): Promise<void> {
  const raw = String(formData.get("language") ?? "");
  if (raw !== "en" && raw !== "fr") return;
  const { profileDetails } = await getServerAccessContext();
  const prisma = getPrisma();
  if (!profileDetails?.id || !prisma) return;
  await prisma.profile.update({ where: { id: profileDetails.id }, data: { language: asDashboardLanguage(raw) } }).catch(() => null);
  revalidatePath("/dashboard", "layout");
}
