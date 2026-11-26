import Link from "next/link";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { hasOrganizerEntitlement } from "@/lib/ai-file-organizer/studio-existing-records";
import { studioEnabled } from "@/lib/studio/production";
import { creditsFor, takbotMode } from "@/lib/takbot/catalog";

export const dynamic = "force-dynamic";
export default async function StudioPage() {
  const access = await requireWorkspacePermission("create_content", "/dashboard/studio");
  if (!studioEnabled(process.env)) return <section className="rounded-2xl border border-slate-200 bg-white p-8"><h1 className="text-2xl font-bold">TAKATAKSTUDIO</h1><p className="my-4 text-slate-600">Le Studio se prépare pour cette plateforme. Les outils actuels du Studio IA restent disponibles. · Studio is being prepared for this platform. Existing AI Studio tools remain available.</p><Link className="text-blue-700 underline" href="/dashboard/ai-studio">Ouvrir le Studio IA · Open AI Studio</Link></section>;
  const mode = takbotMode("write");
  const canConfigureOrganizer = hasEffectivePermission(access, "manage_settings") &&
    await hasOrganizerEntitlement(access.activeClientId);
  return (
    <div className="space-y-4">
      {canConfigureOrganizer && (
        <div className="flex justify-end">
          <Link href="/dashboard/studio/organizer"
            className="inline-flex min-h-11 items-center rounded-lg border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
            AI File Organizer · Settings / Paramètres
          </Link>
        </div>
      )}
      <StudioWorkspace creditsPerDraft={mode ? creditsFor(mode) : null} />
    </div>
  );
}
