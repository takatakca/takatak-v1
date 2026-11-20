import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import type { ModulePlaceholderDef } from "@/lib/dashboard/types";

// Shown for a dashboard space that is not self-serve yet. Clients never see
// internal build notes here: they see what the space is for and a direct way
// to have the TAKATAK team do it for them now.
export function ModulePlaceholder({ def }: { def: ModulePlaceholderDef }) {
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{def.title}</h1>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          Fait par l’équipe TAKATAK · Done by the TAKATAK team
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{def.purpose}</p>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-start gap-3">
          <LifeBuoy size={18} className="mt-0.5 shrink-0 text-blue-700" aria-hidden />
          <div className="space-y-1.5 text-sm leading-relaxed">
            <p className="font-medium text-slate-900">
              Cet espace n’est pas encore en libre-service. L’équipe TAKATAK s’en occupe pour vous : écrivez-nous et
              nous le faisons.
            </p>
            <p className="text-slate-600">
              This space is not self-serve yet. The TAKATAK team handles it for you: write to us and we do it.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/support"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Demander à l’équipe · Ask the team <ArrowRight size={15} aria-hidden />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Retour au tableau de bord · Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
