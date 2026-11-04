// French names and descriptions of the free SEO tools (src/lib/seo/free-tools-catalog.ts).
// Same honesty rules as the English text: a heuristic is called a heuristic, and a
// measure that needs a data connection says so.

export const SEO_TOOL_FR: Record<string, { title: string; description: string }> = {
  "geo-audit": {
    title: "Audit GEO (préparation IA)",
    description: "Vérifie l’exploration, les métadonnées et la structure du contenu pour la découverte par les IA. Ce n’est pas une mesure de classement dans les IA.",
  },
  "ai-search-audit": {
    title: "Audit de recherche IA",
    description: "Tests des vraies réponses des assistants IA par une source de données branchée ; les résultats demandent un échantillonnage vérifié.",
  },
  "chatgpt-visibility-checker": {
    title: "Visibilité dans ChatGPT",
    description: "Observe les vraies citations dans ChatGPT Search une fois une source d’observation prise en charge branchée.",
  },
  "llm-citation-checker": {
    title: "Citations dans les IA",
    description: "Suit les citations par requête et par assistant, avec des preuves, pas des suppositions.",
  },
  "ai-seo-audit": {
    title: "Audit SEO pour l’IA",
    description: "Passe en revue les signaux techniques d’une page publique utiles à la recherche et à la récupération par les IA.",
  },
  "ai-overview-checker": {
    title: "Aperçus IA de Google",
    description: "Observe les aperçus IA de Google pour des requêtes mesurées, là où les sources le permettent.",
  },
  "perplexity-ranking-checker": {
    title: "Citations dans Perplexity",
    description: "Mesure les vraies citations dans Perplexity à partir de réponses enregistrées.",
  },
  "google-index-checker": {
    title: "Indexation Google",
    description: "Vérifie votre propre adresse avec les données d’indexation de Google Search Console. Pas de devinette avec « site: ».",
  },
  "robots-checker": {
    title: "Vérificateur robots.txt",
    description: "Lit le robots.txt en ligne, montre les directives et repère un blocage de tout le site.",
  },
  "robots-generator": {
    title: "Générateur robots.txt",
    description: "Prépare un modèle de règles d’exploration à copier, avec un blocage des robots IA en option.",
  },
  "sitemap-checker": {
    title: "Vérificateur de sitemap",
    description: "Vérifie la présence du sitemap, son type XML, le nombre d’adresses et les adresses d’autres domaines, sur un échantillon limité.",
  },
  "canonical-checker": {
    title: "Balise canonique",
    description: "Lit la balise canonique d’une page et compare son domaine et son chemin.",
  },
  "schema-generator": {
    title: "Générateur de schéma JSON-LD",
    description: "Crée un JSON-LD à copier pour décrire honnêtement une entreprise ou un site web.",
  },
  "llms-generator": {
    title: "Générateur llms.txt",
    description: "Prépare un brouillon de document Markdown de découverte ; l’adoption de llms.txt reste volontaire.",
  },
  "llms-validator": {
    title: "Validateur llms.txt",
    description: "Vérifie les titres Markdown et la syntaxe des liens d’un llms.txt collé.",
  },
  "ai-readability-checker": {
    title: "Lisibilité pour l’IA",
    description: "Évalue le titre, le H1, le résumé, la profondeur du texte et les signaux sémantiques d’une page ; estimation seulement.",
  },
  "h1-checker": {
    title: "Vérificateur H1",
    description: "Inspecte les titres H1 visibles d’une page publique.",
  },
  "keyword-density-checker": {
    title: "Densité de mots-clés",
    description: "Compte les mots-clés d’un ou de plusieurs mots dans un texte collé.",
  },
  "meta-description-checker": {
    title: "Méta-description",
    description: "Inspecte la méta-description d’une page en ligne et sa longueur.",
  },
  "serp-snippet-preview": {
    title: "Aperçu dans Google",
    description: "Prévisualise un titre et une description ; l’extrait réel de Google et sa coupure varient.",
  },
  "open-graph-checker": {
    title: "Open Graph (partages)",
    description: "Vérifie les métadonnées Open Graph et Twitter Card d’une page en ligne.",
  },
  "missing-keywords": {
    title: "Mots-clés manquants",
    description: "Compare de vraies données de mots-clés et une recherche de concurrents une fois les sources branchées.",
  },
  "seo-competitor-analysis": {
    title: "Analyse des concurrents",
    description: "Compare deux domaines avec des données autorisées de mots-clés et de liens.",
  },
};

export const SEO_CATEGORY_FR: Record<string, string> = {
  "AI Visibility & GEO": "Visibilité IA et GEO",
  "Technical SEO": "SEO technique",
  "On-Page & Content": "Page et contenu",
  "Keywords & Competitors": "Mots-clés et concurrents",
};
