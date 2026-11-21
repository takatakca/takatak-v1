import "server-only";

// The account's dashboard language (Account settings › Preferences), read on
// the server. English when no profile or database is available.
import { getPrisma } from "@/lib/db/prisma";

import { asDashboardLanguage, type DashboardLanguage } from "./nav-fr";

export async function getDashboardLanguage(profileId: string | null | undefined): Promise<DashboardLanguage> {
  const prisma = getPrisma();
  if (!profileId || !prisma) return "en";
  const row = await prisma.profile.findUnique({ where: { id: profileId }, select: { language: true } }).catch(() => null);
  return asDashboardLanguage(row?.language);
}
