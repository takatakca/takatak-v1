import Link from "next/link";
import { ModuleHeader } from "@/components/saas/module-header";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import {
  QUEBEC_REQUIREMENTS_REVIEWED_ON,
  quebecRequirements,
  quebecSources,
} from "@/lib/inventory/quebec-requirements";

export const dynamic = "force-dynamic";
export default async function QuebecHoneyRequirementsPage() {
  await requireWorkspacePermission(
    "view_inventory",
    "/dashboard/inventory/quebec",
  );
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Vendre du miel au Québec"
        description={`Dossier de préparation MIEL AISSA — sources officielles consultées le ${QUEBEC_REQUIREMENTS_REVIEWED_ON}.`}
      />
      <div className="flex flex-wrap gap-4 text-sm text-blue-700 underline">
        <Link href="/dashboard/inventory/labels">
          Studio d’étiquettes et suivi des pièces
        </Link>
        <a href="/inventory/MIEL-AISSA-requis-Quebec.pdf" download>
          Télécharger le dossier PDF
        </a>
        <a href="/inventory/MIEL-AISSA-registres-Quebec.zip" download>
          Télécharger les modèles de registres
        </a>
      </div>
      <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <h2 className="font-bold">
          Dossier MIEL AISSA : informations encore à confirmer
        </h2>
        <p>
          La marque, le site et l’adresse ont été fournis. L’exploitant légal,
          l’adresse complète et le lieu de conditionnement restent à vérifier.
          La mention « Produit du Québec » nécessite la preuve d’origine du
          miel. Le pot illustré est annoncé à 288 mL; ni le poids net ni les
          dimensions utiles de l’étiquette n’en découlent.
        </p>
        <p>
          Préciser qui récolte et met en pots, s’il y a des ingrédients ajoutés,
          et les territoires de vente. Ces réponses déterminent les obligations
          applicables. Référencer les décisions dans le studio; ce suivi ne
          constitue ni un permis, ni une approbation de l’étiquette par une
          autorité.
        </p>
      </section>
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700">
        <h2 className="font-bold text-[#0B1B3D]">
          Deux décisions nutritionnelles distinctes
        </h2>
        <p>
          Le miel bénéficie d’une exemption du symbole nutritionnel frontal. Le
          tableau de la valeur nutritive doit toutefois être fourni, sauf
          exemption réellement applicable et documentée. Une dispense liée à
          certaines ventes directes ne s’étend pas automatiquement aux pots
          distribués dans plusieurs épiceries.
        </p>
        <p>
          Sur le pot hexagonal, vérifier le tableau et le code-barres sur leurs
          faces planes respectives. Le tableau doit rester sur un espace
          continu; la dimension approuvée ne doit pas être réduite pour franchir
          un coin. Examiner aussi la taille réelle des caractères et tous les
          emplacements obligatoires sur le tirage posé à 100 %.
        </p>
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        {quebecRequirements.map((item) => (
          <section
            key={item.key}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-xs font-medium text-blue-800">{item.kind}</p>
            <h2 className="font-bold text-[#0B1B3D]">{item.title}</h2>
            <p className="text-sm leading-6 text-slate-700">{item.detail}</p>
            <p className="text-sm leading-6 text-slate-600">
              <strong>Pièces à réunir :</strong> {item.evidence}
            </p>
            <ul className="space-y-2 text-sm text-blue-700 underline">
              {item.sources.map((key) => (
                <li key={key}>
                  <a
                    href={quebecSources[key].url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {quebecSources[key].title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700">
        <h2 className="font-bold text-[#0B1B3D]">
          Tenir les registres de traçabilité
        </h2>
        <p>
          Les modèles à compléter couvrent les réceptions, les lots fabriqués,
          les livraisons professionnelles, les contrôles de poids et les
          retraits. Conserver les documents requis selon votre rôle; les règles
          RSAC prévoient notamment deux ans et une transmission normalement sous
          24 heures sur demande. Les documents électroniques peuvent être
          hébergés ailleurs tout en restant accessibles au Canada.
        </p>
        <p>
          Le journal actuel de stock affiche les 100 derniers mouvements. Il ne
          conserve pas à lui seul les fournisseurs, les destinataires ou les
          liens de transformation entre lots. Utiliser et archiver le registre
          externe complet; référencer son emplacement dans le dossier produit.
          Le lieu d’hébergement des renseignements personnels doit aussi être
          examiné selon les exigences québécoises applicables.
        </p>
      </section>
    </div>
  );
}
