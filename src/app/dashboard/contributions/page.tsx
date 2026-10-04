import { ModerationQueue } from "@/components/contributions/moderation-queue";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Content moderation · TAKATAK",
  robots: { index: false, follow: false },
};

export default async function ContributionsPage() {
  await requireWorkspacePermission("approve_content", "/dashboard/contributions");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">
          TAKATAK Community Content Engine
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Content moderation
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
          Review community-proposed edits for AHMV posts, news, photos, galleries, arenas,
          teams, pages and schedules. Paid membership changes review priority only.
          Every accepted change remains human-approved, versioned and auditable.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Standard</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">1–7 days</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Paid member</p>
          <p className="mt-1 text-xl font-semibold text-orange-950">48 hours</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Authority</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">Human approval</p>
        </div>
      </section>

      <ModerationQueue />
    </div>
  );
}
