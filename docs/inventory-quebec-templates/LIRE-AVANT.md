# MIEL AISSA — modèles de registres à compléter

Modèles vierges préparés le 20 octobre 2026. Ils ne contiennent aucune donnée réelle de production, de fournisseur, de livraison ou de permis.

Lire le dossier `MIEL_AISSA_REQUIS_QUEBEC.md`. Les obligations exactes dépendent des activités et du produit. Ces modèles sont une base de tenue de documents : renseigner les liens amont/production/aval, conserver les factures et fiches originales et adapter les colonnes à vos procédés. Un en-tête vide ne satisfait pas les exigences.

Le ZIP contient aussi `MIEL-AISSA-registres-Quebec.xlsx`, qui réunit les registres et le suivi des pièces dans un même classeur. Les champs de données sont vierges; le suivi commence à « À vérifier ». Ce fichier peut servir de base à une remise électronique regroupée après avoir été rempli et vérifié.

- **01-receptions.csv** : une ligne par produit/lot reçu et document fournisseur.
- **02-conditionnement.csv** : une ligne par relation entre un lot d’intrant et un lot fini. Répéter le lot fini s’il contient plusieurs intrants; distinguer les quantités d’intrant des quantités de pots fabriqués pour éviter de compter plusieurs fois la même production.
- **03-livraisons.csv** : une ligne par produit/lot livré à un client professionnel. Les quantités et unités servent au rapprochement et au retrait; l’identité de chaque consommateur final n’est pas collectée systématiquement pour ce registre.
- **04-controles-poids.csv** : une ligne par contrôle de tare/remplissage, avec appareil, responsable et action si écart.
- **05-retraits-reclamations.csv** : une ligne par événement/action. Relier les lots touchés aux destinataires et à la procédure de retrait.

Le code de lot doit identifier le lot réel; le GTIN identifie la variante commerciale. Les dates, références, responsables et unités doivent permettre de comprendre le dossier sans les déduire d’un code opaque. Ne pas modifier un lot de manière à perdre les liens d’origine.

Les CSV utilisent le point-virgule. Les fichiers du ZIP sont en UTF-8 avec repère d’encodage pour faciliter l’ouverture dans un tableur. Avant archivage, vérifier que toutes les colonnes/dates sont conservées et que les numéros de lots/GTIN n’ont pas perdu leurs zéros initiaux. Importer ces colonnes comme texte. Conserver une copie des originaux, protéger les accès et organiser les sauvegardes.

Appliquer la durée de conservation requise selon votre rôle; les règles RSAC prévoient notamment deux ans et une disponibilité normalement sous 24 heures sur demande, avec les modalités précisées dans le dossier. Ne pas utiliser la liste des 100 derniers mouvements de stock de TakaTak comme archive complète de traçabilité. Référencer l’emplacement et la version du registre dans la rubrique du studio.

Source officielle : https://inspection.canada.ca/fr/salubrite-alimentaire-lindustrie/tracabilite/tracabilite.
