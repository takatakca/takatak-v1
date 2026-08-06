import { redirect } from "next/navigation";
import {
  getPlatformAdminAccess,
  type PlatformAdminRole,
} from "@/lib/security/platform-admin-access";

export interface AdminAccessResult {
  enforced: boolean;
  profileId: string | null;
  role: PlatformAdminRole | null;
}

export async function requireAdminAccess(): Promise<AdminAccessResult> {
  const access =
    await getPlatformAdminAccess();

  if (
    access.mode === "foundation_demo"
  ) {
    return {
      enforced: false,
      profileId: null,
      role: null,
    };
  }

  if (access.mode === "authorized") {
    return {
      enforced: true,
      profileId: access.profileId,
      role: access.role,
    };
  }

  if (
    access.reason ===
    "production_foundation_blocked"
  ) {
    redirect("/");
  }

  if (
    access.reason ===
    "not_authenticated"
  ) {
    redirect(
      "/login?next=%2Fdashboard%2Fadmin",
    );
  }

  redirect("/dashboard");
}