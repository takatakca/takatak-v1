"use client";

import Link from "next/link";
import {
  QUEBEC_REQUIREMENTS_REVIEWED_ON,
  quebecRequirements,
  quebecReviewIssues,
  type QuebecReview,
  type QuebecReviewStatus,
} from "@/lib/inventory/quebec-requirements";

export function QuebecReviewEditor({
  value,
  onChange,
}: {
  value: QuebecReview;
  onChange: (next: QuebecReview) => void;
}) {
  const remaining = quebecReviewIssues(value).length;
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-[#0B1B3D]">
        Dossier de vente du miel au Québec
      </h2>
      <Link
        href="/dashboard/inventory/quebec"
        className="text-sm text-blue-700 underline"
      >
        Consulter les exigences et les sources officielles
      </Link>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        Suivre le dossier Québec pour ce miel
      </label>
      {value.enabled ? (
        <>
          <p className="text-xs leading-5 text-slate-600">
            Référencer les pièces conservées dans votre dossier : document,
            version/date et responsable de la vérification. Une exemption doit
            avoir sa justification. Les références se sauvegardent avec le
            bouton Save product layout. Les pièces communes peuvent renvoyer au
            même dossier d’entreprise.
          </p>
          <p role="status" className="text-sm font-medium text-blue-900">
            {quebecRequirements.length - remaining}/{quebecRequirements.length}{" "}
            rubriques référencées. Ce suivi ne délivre aucun permis ni
            certification de conformité.
          </p>
          {quebecRequirements.map((item) => {
            const row = value.items[item.key];
            const update = (patch: Partial<typeof row>) =>
              onChange({
                ...value,
                items: { ...value.items, [item.key]: { ...row, ...patch } },
              });
            return (
              <fieldset
                key={item.key}
                className="space-y-2 border-t border-slate-100 pt-3"
              >
                <legend className="text-sm font-semibold text-slate-900">
                  {item.title}
                </legend>
                <p className="text-xs text-slate-500">{item.kind}</p>
                <label className="block text-xs text-slate-700">
                  Statut — {item.title}
                  <select
                    aria-label={`Statut — ${item.title}`}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={row.status}
                    onChange={(e) =>
                      update({ status: e.target.value as QuebecReviewStatus })
                    }
                  >
                    <option value="pending">À vérifier</option>
                    <option value="recorded">Pièce référencée</option>
                    {item.allowNotApplicable ? (
                      <option value="not_applicable">
                        Non applicable — justification requise
                      </option>
                    ) : null}
                  </select>
                </label>
                <label className="block text-xs text-slate-700">
                  Référence — {item.title}
                  <textarea
                    aria-label={`Référence — ${item.title}`}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    rows={2}
                    maxLength={600}
                    value={row.reference}
                    placeholder={item.evidence}
                    onChange={(e) => update({ reference: e.target.value })}
                  />
                </label>
              </fieldset>
            );
          })}
          <p className="text-xs leading-5 text-slate-500">
            Sources consultées le {QUEBEC_REQUIREMENTS_REVIEWED_ON}. Le PDF
            reste une épreuve si des rubriques, le poids net, le lot ou les
            autres vérifications de l’étiquette sont incomplets. Réexaminer le
            dossier après changement de recette, d’origine, de lieu ou de
            circuit de vente.
          </p>
        </>
      ) : null}
    </section>
  );
}
