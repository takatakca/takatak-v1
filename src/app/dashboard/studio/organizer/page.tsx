import Link from "next/link";
import { OrganizerSettingsPanel } from "@/components/studio/organizer-settings-panel";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Studio — AI File Organizer | TAKATAK",
  robots: { index: false, follow: false },
};

export default async function StudioOrganizerSettingsPage() {
  // Only a signed active workspace manager can access this dashboard page.
  await requireWorkspacePermission("manage_settings", "/dashboard/studio/organizer");
  return <main className="space-y-6 px-4 py-6 sm:px-6">
    <div className="mx-auto flex max-w-4xl items-center gap-3">
      <Link href="/dashboard/studio" className="text-sm font-semibold text-blue-700 underline underline-offset-4">
        ← Studio
      </Link>
      <span className="text-sm text-slate-500">/ File Organizer</span>
    </div>
    <OrganizerSettingsPanel />
  </main>;
}
