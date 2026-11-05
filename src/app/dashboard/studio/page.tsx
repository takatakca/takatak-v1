import Link from "next/link";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { studioEnabled } from "@/lib/studio/production";
import { creditsFor, takbotMode } from "@/lib/takbot/catalog";

export const dynamic = "force-dynamic";
export default async function StudioPage() {
  await requireWorkspacePermission("create_content", "/dashboard/studio");
  if (!studioEnabled(process.env)) return <section className="rounded-2xl border border-slate-200 bg-white p-8"><h1 className="text-2xl font-bold">TAKATAKSTUDIO</h1><p className="my-4 text-slate-600">Studio is being prepared for this platform. Existing AI Studio tools remain available.</p><Link className="text-blue-700 underline" href="/dashboard/ai-studio">Open AI Studio</Link></section>;
  const mode = takbotMode("write");
  return <StudioWorkspace creditsPerDraft={mode ? creditsFor(mode) : null} />;
}
