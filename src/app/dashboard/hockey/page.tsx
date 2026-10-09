import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { getHockeyMembershipSnapshot } from "@/lib/billing/hockey/membership-service";

export const dynamic = "force-dynamic";

/**
 * Legacy compatibility gateway only.
 *
 * AHMV is not a TAKATAK Dashboard module. It never renders hockey UI here.
 * Existing bookmarks are accepted only for identities with ahmv_access and
 * are immediately handed to the independent AHMV experience.
 */
export default async function LegacyAhmvGatewayPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=%2Fdashboard%2Fhockey");
  }

  const membership = await getHockeyMembershipSnapshot(user.id);
  if (!membership.hasAhmvAccess) {
    notFound();
  }

  redirect("/api/experiences/ahmv/launch");
}
