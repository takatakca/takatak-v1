import Link from "next/link";
import { OrganizerSettingsPanel } from "@/components/studio/organizer-settings-panel";
import { OrganizerFilingInbox } from "@/components/studio/organizer-filing-inbox";
import { hasOrganizerEntitlement } from "@/lib/ai-file-organizer/studio-existing-records";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Studio — AI File Organizer",
  robots: { index: false, follow: false },
};

export default async function StudioOrganizerPage() {
  const access = await requireWorkspacePermission(
    "manage_settings", "/dashboard/studio/organizer",
  );
  const entitled = await hasOrganizerEntitlement(access.activeClientId);
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <Link href="/dashboard/studio" className="text-sm font-semibold text-blue-700 hover:underline">
        ← TAKATAKSTUDIO
      </Link>
      {entitled ? (
        <OrganizerSettingsPanel />
      ) : (
        <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-slate-900">AI File Organizer</h1>
          <p className="mt-3 text-slate-700">
            This workspace does not have an enabled Organizer pilot. Existing
            Studio drafts and files remain accessible through their normal tools.
            No AI processing or organizer charges have been enabled.
          </p>
        </section>
        {process.env.TAKATAK_AI_FILE_ORGANIZER_ENABLED === "true" && (
          <OrganizerFilingInbox
            language="en" projects={[]} outputs={[]} allowedDestinationIds={[]}
            canPropose={false} historyOnly
          />
        )}
        </div>
      )}
    </main>
  );
}
