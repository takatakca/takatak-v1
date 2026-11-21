import { Info } from "lucide-react";

/** What reports do today, said plainly on the reporting pages. */
export function ReportBoundaryWarning() {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <p className="text-xs leading-relaxed text-slate-600">
        Chaque rapport se télécharge en PDF et se remet dans le tableau de bord ; le rapport mensuel automatique arrive le 1er du mois.
        Aucun lien public ni courriel n’est envoyé · Every report downloads as a PDF and is delivered in the dashboard; the automatic
        monthly report arrives on the 1st. No public link or email is sent.
      </p>
    </div>
  );
}
