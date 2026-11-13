import { ServiceError } from "./service-error";

export const QUEBEC_REQUIREMENTS_REVIEWED_ON = "2026-10-20";
export const quebecSources = {
  permits: {
    title: "MAPAQ — permis alimentaires",
    url: "https://www.quebec.ca/entreprises-et-travailleurs-autonomes/industrie-bioalimentaire/permis-alimentaires",
  },
  farm: {
    title: "MAPAQ — vente de produits agricoles",
    url: "https://www.quebec.ca/entreprises-et-travailleurs-autonomes/industrie-bioalimentaire/permis-alimentaires/permis-restauration-vente-detail/vente-produits-agricoles",
  },
  retailPermit: {
    title: "MAPAQ — préparation et vente au détail",
    url: "https://www.quebec.ca/entreprises-et-travailleurs-autonomes/industrie-bioalimentaire/permis-alimentaires/permis-restauration-vente-detail",
  },
  training: {
    title: "MAPAQ — formation en hygiène et salubrité",
    url: "https://www.quebec.ca/sante/alimentation/salubrite-aliments-prevention-risques/etablissements-alimentaires/hygiene-nettoyage/formation-obligatoire-hygiene-salubrite-alimentaires",
  },
  federal: {
    title: "ACIA — activités liées au miel et exigences du RSAC",
    url: "https://inspection.canada.ca/fr/salubrite-alimentaire-lindustrie/apercu-exigences-cles-du-rsac-produit-alimentaire",
  },
  honey: {
    title: "ACIA — étiquetage du miel",
    url: "https://inspection.canada.ca/fr/etiquetage-aliment/etiquetage/industrie/miel",
  },
  nutrition: {
    title: "ACIA — exemptions du tableau de la valeur nutritive",
    url: "https://inspection.canada.ca/fr/etiquetage-aliment/etiquetage/industrie/etiquetage-nutritionnel/exemptions",
  },
  label: {
    title: "ACIA — liste de vérification de l’étiquette",
    url: "https://inspection.canada.ca/fr/etiquetage-aliment/etiquetage/industrie/liste-verification-exigences",
  },
  french: {
    title: "OQLF — inscriptions sur les produits",
    url: "https://www.oqlf.gouv.qc.ca/francisation/entreprises/marque-commerce-produits.html",
  },
  traceability: {
    title: "ACIA — traçabilité des aliments",
    url: "https://inspection.canada.ca/fr/salubrite-alimentaire-lindustrie/tracabilite/tracabilite",
  },
  identity: {
    title: "Québec — immatriculation d’une entreprise",
    url: "https://www.quebec.ca/entreprises-et-travailleurs-autonomes/demarrer-entreprise/immatriculer-constituer-entreprise/immatriculation-entreprise/a-propos",
  },
  municipality: {
    title: "Montréal — permis d’occupation",
    url: "https://montreal.ca/demarches/obtenir-un-permis-doccupation-pour-activite-commerciale-industrielle-ou-professionnelle",
  },
  taxes: {
    title: "Revenu Québec — produits alimentaires",
    url: "https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/situations-particulieres-liees-a-la-tpstvh-et-a-la-tvq/alimentation-application-de-la-tps-et-de-la-tvq/produits-alimentaires/",
  },
  address: {
    title: "ACIA — nom et principal lieu d’affaires",
    url: "https://inspection.canada.ca/fr/etiquetage-aliments/etiquetage/industrie/nom-principal-lieu-daffaires",
  },
  dates: {
    title: "ACIA — datation et entreposage",
    url: "https://inspection.canada.ca/fr/etiquetage-aliments/etiquetage/industrie/datation-directives-dentreposage",
  },
  scale: {
    title: "Mesures Canada — vente d’aliments au poids",
    url: "https://www.ised-isde.canada.ca/site/mesures-canada/fr/consommateurs/achat-biens-mesures/vente-achat-daliments-poids",
  },
  organic: {
    title: "CARTV — appellation biologique",
    url: "https://cartv.gouv.qc.ca/outils-et-ressources/information-au-public-et-aux-entreprises/bio-et-consommateurs/",
  },
  retailers: {
    title: "GS1 Canada — préparation aux détaillants",
    url: "https://gs1ca.org/grocery/checklist/",
  },
  online: {
    title: "OPC — obligations du commerce en ligne",
    url: "https://www.opc.gouv.qc.ca/enligne/",
  },
  privacy: {
    title: "CAI — communication des renseignements personnels",
    url: "https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/utilisation-communication-renseignements-personnels",
  },
  packaging: {
    title: "Québec — collecte sélective et responsabilité des producteurs",
    url: "https://www.quebec.ca/nouvelles/actualites/details/gestion-des-matieres-residuelles-entree-en-vigueur-du-systeme-modernise-de-collecte-selective-60350",
  },
} as const;

export const quebecRequirements = [
  {
    key: "business",
    title: "Entreprise, lieux et obligations connexes",
    kind: "Selon l’activité",
    detail:
      "Confirmer le responsable légal, l’immatriculation applicable, le nom utilisé et l’adresse complète. Vérifier l’usage autorisé du local, la fiscalité, les emballages et, si vente en ligne ou données clients, les obligations OPC et de protection des renseignements personnels.",
    evidence:
      "Identité de l’exploitant, adresse du conditionnement, décisions sur les obligations et références des pièces.",
    allowNotApplicable: false,
    sources: [
      "identity",
      "municipality",
      "taxes",
      "online",
      "privacy",
      "packaging",
    ],
  },
  {
    key: "permits",
    title: "Permis, licences et exemptions justifiées",
    kind: "Selon l’activité",
    detail:
      "Qualifier production, achat en vrac, mise en pots, vente directe ou fourniture aux épiceries. L’exception agricole exige les conditions MAPAQ applicables; une marque québécoise ne l’établit pas. Examiner les licences fédérales si importation, préparation interprovinciale ou exportation.",
    evidence:
      "Permis valides et activités couvertes, ou décision d’exemption motivée avec source et date.",
    allowNotApplicable: true,
    sources: ["permits", "farm", "retailPermit", "federal"],
  },
  {
    key: "sanitation",
    title: "Salubrité et conditionnement",
    kind: "Obligation légale; modalités selon l’activité",
    detail:
      "Documenter les locaux, le nettoyage, l’eau utilisée, les emballages adaptés au contact alimentaire, la maîtrise des contaminants et les conditions de stockage. Vérifier les formations requises et les contrôles pertinents pour chaque recette.",
    evidence:
      "Procédures, responsable, attestations applicables et spécifications du fournisseur des pots/couvercles.",
    allowNotApplicable: false,
    sources: ["training", "retailPermit"],
  },
  {
    key: "product",
    title: "Recette, origine et mentions",
    kind: "Obligation légale",
    detail:
      "Distinguer miel pur et préparation avec ajouts; justifier les ingrédients, allergènes et le nom usuel. Conserver la preuve de récolte au Québec avant d’employer cette origine. Vérifier les mentions de qualité, de traitement, de santé ou de production biologique.",
    evidence:
      "Fiche recette, documents du fournisseur/récolte et preuves des allégations, ou absence d’allégations.",
    allowNotApplicable: false,
    sources: ["honey", "label", "organic"],
  },
  {
    key: "label",
    title: "Étiquette française et mentions réglementaires",
    kind: "Obligation légale; mentions propres au circuit",
    detail:
      "Vérifier français et bilinguisme applicable, nom usuel, adresse, lisibilité réelle, emplacement et dimensions des caractères. Décider les mentions d’origine, catégorie, couleur, conservation et datation selon le produit et son circuit. Relire le tirage à 100 % sur le pot.",
    evidence:
      "Version de maquette, mesures, décision sur catégorie/couleur/origine et compte rendu daté de relecture.",
    allowNotApplicable: false,
    sources: ["french", "label", "honey", "address", "dates"],
  },
  {
    key: "quantity",
    title: "Poids net réel et format du contenant",
    kind: "Obligation légale",
    detail:
      "Déclarer le miel en g ou kg et contrôler la tare et le remplissage réel. La capacité annoncée de 288 mL ne prouve pas ce poids. Vérifier la balance selon l’usage et les formats réglementés si le circuit du miel y est assujetti.",
    evidence:
      "Poids net retenu, procédure de contrôle, relevés de pesée et examen du format pour le circuit visé.",
    allowNotApplicable: false,
    sources: ["honey", "scale"],
  },
  {
    key: "nutrition",
    title: "Tableau de la valeur nutritive et exemptions",
    kind: "Obligation légale; exemptions conditionnelles",
    detail:
      "Préparer le tableau conforme à la recette ou justifier une exemption exacte. La vente dans plusieurs épiceries ne bénéficie pas automatiquement d’une exception de vente directe. Le miel est exempté du symbole nutritionnel frontal; cette exemption est distincte de celle du tableau.",
    evidence:
      "Tableau bilingue approuvé à ses dimensions réelles, ou justification documentée de l’exemption applicable.",
    allowNotApplicable: false,
    sources: ["nutrition", "honey", "label"],
  },
  {
    key: "traceability",
    title: "Lots, fournisseurs, livraisons et rappel",
    kind: "Obligation légale selon le rôle; préparation de la distribution",
    detail:
      "Relier chaque lot fini à ses fournisseurs et aux clients professionnels livrés. Prévoir le retrait des lots, conserver les documents selon les règles applicables et pouvoir les fournir rapidement. Le journal de stock et son champ lot ne constituent pas à eux seuls ce dossier.",
    evidence:
      "Registres amont/production/aval, responsable de retrait, accès aux pièces et essai de recherche d’un lot.",
    allowNotApplicable: false,
    sources: ["traceability"],
  },
  {
    key: "retail",
    title: "Admission chez le détaillant",
    kind: "Condition commerciale du détaillant",
    detail:
      "Obtenir les identifiants demandés, transmettre la fiche produit et un échantillon, vérifier le code imprimé et faire créer l’article/prix en caisse. Assurance, données, certification ou EDI dépendent du contrat du magasin; ce ne sont pas tous des permis légaux universels.",
    evidence:
      "Liste d’exigences du magasin, validation fournisseur/article et résultat du test caisse, ou vente directe uniquement.",
    allowNotApplicable: true,
    sources: ["retailers"],
  },
] as const;

export type QuebecRequirementKey = (typeof quebecRequirements)[number]["key"];
export type QuebecReviewStatus = "pending" | "recorded" | "not_applicable";
export type QuebecReview = {
  enabled: boolean;
  items: Record<
    QuebecRequirementKey,
    { status: QuebecReviewStatus; reference: string }
  >;
};
export function defaultQuebecReview(enabled = false): QuebecReview {
  return {
    enabled,
    items: Object.fromEntries(
      quebecRequirements.map(({ key }) => [
        key,
        { status: "pending", reference: "" },
      ]),
    ) as QuebecReview["items"],
  };
}
export function quebecReviewInput(
  value: unknown,
  enabledByDefault = false,
): QuebecReview {
  const result = defaultQuebecReview(enabledByDefault);
  if (value === undefined) return result;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ServiceError(
      "invalid_input",
      "Le dossier Québec doit être un objet.",
    );
  const b = value as Record<string, unknown>;
  if (
    typeof b.enabled !== "boolean" ||
    !b.items ||
    typeof b.items !== "object" ||
    Array.isArray(b.items)
  )
    throw new ServiceError("invalid_input", "Le dossier Québec est incomplet.");
  result.enabled = b.enabled;
  const items = b.items as Record<string, unknown>;
  for (const { key, allowNotApplicable } of quebecRequirements) {
    const entry = items[key];
    if (entry === undefined) continue;
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new ServiceError(
        "invalid_input",
        `Pièce Québec invalide : ${key}.`,
      );
    const row = entry as Record<string, unknown>;
    if (
      !["pending", "recorded", "not_applicable"].includes(String(row.status)) ||
      (row.status === "not_applicable" && !allowNotApplicable)
    )
      throw new ServiceError(
        "invalid_input",
        `Statut Québec invalide : ${key}.`,
      );
    if (
      typeof row.reference !== "string" ||
      row.reference.length > 600 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(row.reference)
    )
      throw new ServiceError(
        "invalid_input",
        `La référence ${key} doit contenir au plus 600 caractères.`,
      );
    result.items[key] = {
      status: row.status as QuebecReviewStatus,
      reference: row.reference.trim(),
    };
  }
  return result;
}
export function quebecReviewIssues(review: QuebecReview): string[] {
  if (!review.enabled) return [];
  return quebecRequirements
    .filter(
      ({ key }) =>
        review.items[key].status === "pending" || !review.items[key].reference,
    )
    .map(({ title }) => `Dossier Québec à compléter : ${title}.`);
}
export function invalidateQuebecReview(value: unknown): QuebecReview {
  const review = quebecReviewInput(value);
  for (const row of Object.values(review.items)) row.status = "pending";
  return review;
}
export function hasMetricHoneyMass(size: string): boolean {
  const match = /^(\d+(?:[.,]\d+)?)\s*(g|kg)$/.exec(size.trim());
  return (
    !!match &&
    Number(match[1].replace(",", ".")) > 0 &&
    Number.isFinite(Number(match[1].replace(",", ".")))
  );
}
