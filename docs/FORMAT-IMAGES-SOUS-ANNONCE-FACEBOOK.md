# IMAGES SOUS L'ANNONCE FACEBOOK — « More from [Page] » — DIRECTIONS CLAIRES TAKATAK

**Ordre de Matt, 2026-11-19 09:04** (capture Facebook JOY Wellness Club, 09:03) : « quand je mets mes posts, je veux les images qui apparaissent en dessous de mon annonce, comme dans la capture » — à appliquer à **toutes les publicités et tous les posts Facebook de toutes les marques/groupes TAKATAK**.
**Signé : Taktak — 2026-11-19.**

---

## RÉSUMÉ EN 3 LIGNES — « QUAND ON FAIT UNE PUB/POST, ON FAIT ÇA »

1. **Chaque Page a d'abord un catalogue Meta (Commerce Manager) de la marque, avec au moins 4 produits/services** — image réelle Canva + titre court par item. C'est CE catalogue qui alimente les cartes-images sous l'annonce. Pas de catalogue = pas d'images en dessous, jamais.
2. **Publicité payante : on active « Products » (fonction *Show products*) au niveau de l'annonce** (Ads Manager → niveau annonce → *Creative setup* → *Products* = ON, catalogue + ensemble de produits de LA marque), OU on construit directement un format garanti : **Collection** (image/vidéo vedette + tuiles produits dessous) ou **Carrousel** (2–10 cartes).
3. **Post organique : il n'existe AUCUN équivalent automatique** — un post ordinaire ne reçoit pas de section « More from » tout seul. On publie donc le post en **multi-photos**, en **carrousel** (créé dans Ads Manager puis publié via *Page posts*), ou avec des **produits étiquetés** du catalogue.

---

## 1. CE QUE MONTRE LA CAPTURE — LE MÉCANISME, EXACTEMENT

Dans la capture de Matt (fil mobile, 2026-11-19 09:03) :

- En haut : la publicité principale de **JOY Wellness Club** — texte « Première visite 29 $. Normalement 59 $. À 5 minutes du métro Peel. », bouton **Book**, réactions/commentaires/partages.
- Juste dessous, **après** la barre d'engagement : une section avec une **icône de sac d'achat** et l'en-tête **« More from JOY Wellness Club »**, contenant un **carrousel horizontal de cartes-images** de LA MÊME entreprise : « Come with a friend » (sauna), « Thérapie par lumière ro… » (lumière rouge), « Saun… » (coupé).

### Verdict vérifié (recherche du 2026-11-19, sources §9)

- **L'en-tête exact « More from [nom de la Page] » n'est pas un format que l'on construit carte par carte et Meta ne le documente pas mot à mot dans son centre d'aide public.** C'est la façon dont le **fil Facebook mobile affiche le contenu Boutique/catalogue de la Page** rattaché à l'annonce : les cartes sont des **items du catalogue** de l'entreprise (chez JOY : des services — les titres de cartes sont les titres des items du catalogue, sans prix affiché dans ce rendu).
- **Le mécanisme officiel, documenté et contrôlable qui produit « des produits de ton catalogue SOUS ton média principal » s'appelle *Show products*** (en français : « Afficher les produits » ; aussi appelé **Product showcase** ; ancien nom : **product extensions** ; dans l'API Marketing : `product_extensions`). La documentation développeur de Meta le décrit comme une optimisation Advantage+ creative qui « présente les produits de votre catalogue **sous votre média unique statique** lorsqu'il est probable que cela améliore la performance ».
- **Conséquence honnête, à ne jamais oublier : *Show products* est AUTOMATIQUE côté affichage.** On l'active et on choisit le catalogue/ensemble, mais **Meta décide** si les cartes apparaissent, combien, dans quel ordre et dans quelle mise en page, à chaque impression. **Elles n'apparaissent PAS à toutes les impressions.** Si on veut des images dessous **à coup sûr**, il faut un format construit : **Collection** ou **Carrousel** (§4 et §5).
- **À ne pas confondre — PIÈGE :** les « publicités multi-annonceurs » (*multi-advertiser ads*) affichent un carrousel « **More for you** » sous une annonce, mais avec les produits **D'AUTRES entreprises** (possiblement des concurrents). Ce n'est **PAS** ce que Matt veut. Ne jamais activer la case multi-annonceurs en croyant obtenir « More from » de SA marque.

---

## 2. LES 3 MÉCANISMES — TABLEAU DE DÉCISION

| Mécanisme | Nom officiel Meta | Images sous l'annonce principale ? | Contrôle | Source des cartes |
|---|---|---|---|---|
| **A. Show products** | *Show products* / *Product showcase* (ancien : *product extensions*) ; interrupteur **Products** dans *Creative setup* | Oui, **quand Meta juge que ça aide** — pas garanti, pas à chaque impression | On active + on choisit catalogue/ensemble ; Meta choisit affichage, nombre, ordre, mise en page | Catalogue Commerce Manager (ensemble de produits choisi) |
| **B. Collection** | *Collection ads* | **Oui, garanti par construction** : image/vidéo vedette + **3 images produits dessous** dans le fil Facebook ; mobile seulement | Total : on choisit la vedette, l'ensemble (≥ 4 items) et l'Instant Experience | Catalogue (ensemble) ou images choisies |
| **C. Carrousel** | *Carousel ads* | Les cartes **sont** l'annonce : 2–10 cartes défilantes, chacune avec son titre, son lien et son appel à l'action | Total : ordre verrouillable | Téléversement manuel ou catalogue |

**Règle TAKATAK par défaut :** A **toujours activé** sur les annonces image/vidéo unique + B ou C quand l'annonce doit montrer plusieurs services/produits à coup sûr. (Le carrousel est déjà le format par défaut ordonné par Matt le 2026-10-31 — mission M-35, document `docs/FORMAT-PUBLICITAIRE-CARROUSEL-META.md` dans le dépôt QUADROHOLDING. Le présent document le complète : il ajoute le catalogue et *Show products*, il ne remplace pas M-35.)

---

## 3. PRÉREQUIS — PAR MARQUE / PAR PAGE (À FAIRE UNE FOIS, PUIS À TENIR À JOUR)

Sans ces prérequis, **rien** ne s'affichera sous les annonces de la marque. Un catalogue **par marque** (jamais un catalogue mélangé de plusieurs marques — règle d'entité séparée de Matt).

1. **Catalogue dans Meta Commerce Manager**, rattaché au portefeuille d'entreprise (*business portfolio*) de la marque, contenant **au moins 4 produits/services** (minimum exigé pour *Show products* et pour Collection).
2. **Chaque item du catalogue contient :**
   - une **image réelle** de la marque, passée par **Canva** (voir règles §8) — l'image de l'item EST l'image de la carte ;
   - un **titre court et clair** — le titre de l'item EST le texte sous la carte (ex. JOY : « Come with a friend », « Thérapie par lumière rouge ») ;
   - un **lien (URL) vers la page du produit/service sur le site de la marque** — idéalement le **même domaine** que le lien de destination de l'annonce (sinon Ads Manager avertit : « le catalogue sélectionné ne correspond pas à cette URL »).
3. **Ensembles de produits (*product sets*) par famille** dans le catalogue (ex. restaurants : par section de menu ; agence : par service) — c'est l'ensemble qu'on sélectionne annonce par annonce.
4. **Boutique (*Shop*) de la Page reliée au même catalogue** : c'est le contenu Boutique/catalogue que le fil regroupe sous l'en-tête « More from [Page] » (icône sac d'achat dans la capture). Page sans boutique/catalogue actif = section « More from » vide ou absente.
5. **La Page publie régulièrement des posts avec images réelles** : ça nourrit la présence de la Page et ses collections Boutique ; ce n'est **pas** le déclencheur technique de *Show products* (le déclencheur, c'est le catalogue + l'interrupteur *Products*), mais une Page morte n'a rien à montrer.
6. **Pour les campagnes catalogue/reciblage** (si on s'en sert) : pixel Meta sur le site de la marque avec les événements `ViewContent`, `AddToCart`, `Purchase` portant les IDs du catalogue.
7. **Accès** : compte publicitaire + Page + catalogue dans le **même portefeuille d'entreprise**, avec les permissions de publier (règle : un compte par marque, une session à la fois).

---

## 4. PROCÉDURE A — PUBLICITÉ PAYANTE AVEC *SHOW PRODUCTS* (Ads Manager, niveau annonce)

1. Ads Manager → **+ Créer** → objectif compatible : **Ventes, Trafic, Génération de prospects (Leads), Engagement ou Promotion d'application** (objectifs listés par le centre d'aide Meta pour *Show products*). Si l'objectif est **Ventes** : s'assurer que la campagne n'est **pas** une campagne catalogue Advantage+ (sinon on construit une annonce catalogue, pas une annonce avec *Show products*).
2. Ensemble de publicités : emplacement de conversion (site web, application, Messenger/WhatsApp) et placements incluant **Fil Facebook / Fil Instagram** (voir limites §7).
3. Niveau **annonce** → *Ad setup* (Configuration de l'annonce) → **Manual upload (Téléversement manuel)** → format **Single image or video (Image ou vidéo unique)**. ⚠️ *Show products* ne fonctionne **que** sur image/vidéo unique — **pas** sur un carrousel ni sur une annonce catalogue.
4. Téléverser le média principal (image/vidéo réelle Canva), écrire le texte principal : **offre + lien cliquable, jamais de prix dans le visuel** (§8).
5. *Creative setup* (Configuration créative) → section **Products** → **ON** (elle peut déjà être activée par défaut sur certains comptes — **vérifier, ne jamais présumer**) → sélectionner le **catalogue de LA marque** et l'**ensemble de produits** de la famille annoncée.
6. *Format display options* (Options d'affichage du format) → cocher **Show products** sous les mises en page **Carousel** et **Collection** si on veut aussi ces rendus.
7. **Vérifier les aperçus** Fil Facebook mobile + Fil Instagram : les cartes sous le média doivent être celles de la marque, bons titres, bons liens.
8. Publier. Après publication, rouvrir l'annonce : dans *Ad creative*, on doit lire **« Turned on: Products »** — c'est la preuve que c'est actif.

## 5. PROCÉDURE B — IMAGES DESSOUS GARANTIES : COLLECTION ET CARROUSEL

### B1. Collection (le rendu le plus proche de la capture, garanti)

1. Ads Manager → + Créer → objectif **Ventes, Trafic, Engagement, Notoriété ou Prospects**.
2. Placements **mobiles seulement** (Collection n'existe pas sur ordinateur) : Fil Facebook, Fil Instagram, Stories/Reels selon l'objectif.
3. Niveau annonce → format **Collection** → image ou vidéo **vedette** (la couverture) → ensemble de produits du catalogue (**au moins 4 items** ; Meta recommande un ensemble large, max. 50 produits montrés après le clic).
4. Construire l'**Instant Experience** liée (vitrine) : c'est elle qui s'ouvre au clic sur la vedette ; les petites images dessous viennent des items.
5. Aperçu Fil Facebook : **vedette + 3 images produits dessous** = le visuel voulu. Publier seulement si l'aperçu montre les bonnes images.

### B2. Carrousel (format par défaut TAKATAK — rappel M-35)

1. Niveau annonce → *Ad setup* → **Manual upload** → format **Carousel**.
2. **+ Add cards** : **2 à 10 cartes**, image **1:1, 1080 × 1080 px minimum** (JPG/PNG ≤ 30 Mo), **une carte par section de menu / par service**, chacune avec **son titre, sa description et son URL**.
3. Si l'ordre raconte quelque chose (sections, étapes) : **décocher** « afficher d'abord les cartes les plus performantes » (*Highlight carousel card*), sinon Meta réordonne.
4. Texte principal : offre + lien cliquable ; **aucun prix dans les images de cartes**.

---

## 6. PROCÉDURE C — POSTS ORGANIQUES DE PAGE (SANS BUDGET PUB)

**Vérité à retenir : un post organique ordinaire ne génère PAS de section « More from » sous lui-même.** Cette section du fil est rattachée aux annonces et au contenu Boutique/catalogue. Pour qu'un post de Page montre lui aussi des images en dessous / en défilement, on utilise une de ces 4 routes :

1. **Post multi-photos** : Page → Créer un post → Photo/vidéo → téléverser **plusieurs images réelles** d'un coup (rendu grille/mosaïque ; au clic, défilement plein écran). Un seul texte et un seul lien pour tout le post.
2. **Vrai carrousel organique (cartes avec titre + lien par carte)** : Ads Manager → créer une annonce **Carrousel** (procédure B2, sans lancer de campagne payée) → menu **Page posts (Publications de la Page)** → **Ad posts** → sélectionner le carrousel → **Publish (Publier)** : il part sur la Page **en organique, sans dépense**.
3. **Produits étiquetés** : dans un post photo/vidéo de la Page, **étiqueter les produits du catalogue/Boutique** visibles dans l'image (jusqu'à 30 produits par post) — chaque étiquette ouvre la fiche produit.
4. **Partager un item/une collection Boutique sur le fil de la Page** : Page → onglet Boutique → Partager le produit ou la collection — le post affiche l'image produit et mène à la Boutique, ce qui alimente aussi le contenu que le fil regroupe sous « More from [Page] ».

---

## 7. LIMITES CONNUES (à dire avant, pas après)

- ***Show products* : affichage non garanti.** Meta décide par impression ; nombre, ordre et mise en page varient selon le placement, le média et l'audience. Ne jamais promettre à un client « les images seront toujours là » pour le mécanisme A — promettre le format B ou C.
- **Placements *Show products*** : **Fil Facebook, Fil Instagram, Stories et Reels** seulement. Sur les autres placements, l'annonce roule sans les produits.
- **Collection : mobile seulement**, jamais sur ordinateur.
- **Carrousel** : 2–10 cartes (Stories Instagram : 2–3) ; indisponible pour certains emplacements de conversion (« Sur votre annonce », Page Facebook) et l'option d'affichage carrousel n'existe pas pour les annonces « cliquer pour WhatsApp ».
- **Catalogue trop petit ou absent** = l'option *Products* n'apparaît pas dans *Creative setup*.
- **Domaine incohérent** entre l'URL de l'annonce et les liens du catalogue = avertissement Ads Manager et affichage compromis.
- Les pages du centre d'aide Meta se chargent en JavaScript et n'ont pas pu être relues en texte intégral le 2026-11-19 ; les faits ci-dessus sont tirés des titres officiels cités en §9 et de guides secondaires qui les citent et les ont vérifiés en novembre 2026. **À re-vérifier dans l'interface réelle du compte au moment de la première application** (les libellés FR/EN varient selon les comptes).

---

## 8. RÈGLES DE MATT — À APPLIQUER SUR CHAQUE CARTE (PERMANENT)

1. **Images réelles seulement, via Canva** : toute image de carte/post passe d'abord par Canva (ouverte et sauvegardée dans Canva, publiée depuis Canva quand c'est un post). **Aucun contenu généré par IA** comme visuel de marque.
2. **Désactiver les « améliorations » créatives Advantage+ qui fabriquent ou modifient des images** (expansion d'image, arrière-plans générés, retouches automatiques) sur nos annonces : on active **Products**, on n'active **pas** la génération d'images. Nos images restent nos images.
3. **Jamais de prix dans les visuels** : aucun prix sur les images de cartes ni dans les images du catalogue. Attention : les **superpositions dynamiques** (*dynamic overlays* / étiquettes d'info) peuvent imprimer un prix du catalogue sur l'image → **les laisser ÉTEINTES**. Le texte de l'annonce porte l'**offre + un lien cliquable**, pas un prix en image.
4. **« Breuvage », jamais « boisson »** — dans les titres d'items du catalogue comme dans les textes d'annonces.
5. **Un catalogue, un ensemble, une Page — par marque.** Jamais les items d'une autre marque dans le carrousel d'une annonce.
6. Aucune pousse payante sans le budget de Matt (règle inchangée) ; ces directions disent **comment** construire, pas **combien** dépenser.

---

## 9. CHECKLIST DE VÉRIFICATION — AVANT CHAQUE PUBLICATION

- [ ] La Page de la marque a un **catalogue actif ≥ 4 items**, images Canva réelles, titres courts, liens vivants (aucun 404).
- [ ] L'**ensemble de produits** choisi = la famille annoncée (bonne section de menu / bon service).
- [ ] Annonce image/vidéo unique → ***Products* = ON** dans *Creative setup*, bon catalogue, bon ensemble.
- [ ] OU format **Collection/Carrousel** construit, si les images dessous doivent être **garanties**.
- [ ] **Aperçus mobile** Fil Facebook + Fil Instagram relus : cartes = bonnes images, bons titres, ordre voulu (ordre verrouillé si récit).
- [ ] **Aucun prix visible** sur aucune image (y compris superpositions dynamiques éteintes).
- [ ] Améliorations IA de génération d'images **éteintes** ; multi-annonceurs **non** confondu avec « More from ».
- [ ] Texte : offre + **lien cliquable** ; « breuvage » si breuvage il y a.
- [ ] Post organique : route §6 choisie (multi-photos / carrousel publié via *Page posts* / produits étiquetés / partage Boutique) — pas d'attente d'un « More from » automatique.
- [ ] Après publication : rouvrir l'annonce et confirmer **« Turned on: Products »** ou le format, puis consigner (Page, campagne, catalogue, ensemble) au registre.

## 10. PIÈGES DÉJÀ CONNUS

1. **Chercher un bouton « More from »** : il n'existe pas. Chercher *Products* dans *Creative setup*, ou les formats Collection/Carrousel.
2. **Activer *Show products* sur un carrousel** : impossible — image/vidéo unique seulement. Pour un carrousel, les cartes sont déjà là.
3. **Catalogue d'une autre marque sélectionné** (comptes partagés) : les cartes d'une marque sous l'annonce d'une autre = erreur grave, à vérifier dans l'aperçu à chaque fois.
4. **Croire l'aperçu ordinateur** : la section sous l'annonce est un rendu **mobile/Fil** — vérifier l'aperçu mobile.
5. **Prix qui « apparaît tout seul »** : vient du catalogue/superpositions — corriger à la source (éteindre les superpositions, vérifier le rendu), ne pas maquiller l'image.
6. **« More for you » ≠ « More from »** : le premier montre les autres ; le second montre NOUS. Ne pas cocher multi-annonceurs pour obtenir l'effet de la capture.

---

## 11. SOURCES (consultées le 2026-11-19)

Titres officiels Meta cités par les guides ci-dessous (centre d'aide aux entreprises Meta / Meta for Developers) : *About ads showing product media* ; *Show products from your catalog with your ad creative* ; documentation développeur *Product extensions* (Advantage+ catalog ads) ; *Collection Ads* (Meta for Developers) ; *About carousel ads* ; *Design specifications for carousel ads* ; *About collection ads*.

Guides secondaires vérifiés qui citent et appliquent ces sources officielles :

- https://admanage.ai/blog/meta-show-products — *Show products* vs annonces catalogue vs Collection ; définition développeur Meta (« sous votre média unique statique »), prérequis (catalogue ≥ 4 items, objectifs, placements), procédure en 7 étapes.
- https://dev.admanage.ai/blog/how-to-set-up-meta-show-products — tutoriel *Show products*, interrupteur et aperçus Ads Manager.
- https://powerads.group/hub/meta-default-on-ad-features-audit/ — état des fonctions activées par défaut chez Meta au 2026-11-18 (*Product showcase* / `product_extensions`, peut être actif par défaut dans *Creative setup*).
- https://www.creahive.com/guides/facebook-carousel-ads/ — carrousel : specs et procédure d'après le centre d'aide Meta et le Meta Ads Guide (vérifiés le 2026-11-10).
- https://www.creahive.com/guides/facebook-collection-ads/ — Collection : vedette + 3 produits dessous dans le fil, ≥ 4 items, mobile (vérifiés le 2026-11-10).
- https://socialrails.com/blog/facebook-carousel-posts-guide — carrousel organique : créé dans Ads Manager puis publié via *Page posts → Ad posts*, sans dépense.
- https://www.jonloomer.com/how-multi-advertiser-ads-work/ — publicités multi-annonceurs (« More for you ») : à ne pas confondre avec « More from [Page] ».

---

## 12. JOURNAL — NOTES AVANT / PENDANT / APRÈS (signé Taktak)

- **AVANT (2026-11-19, Taktak)** : ordre de Matt reçu 09:04 avec capture JOY Wellness Club (09:03). État lu avant d'écrire : fichier maître (mission M-35 carrousel Meta du 2026-10-31, dépôt QUADROHOLDING `docs/FORMAT-PUBLICITAIRE-CARROUSEL-META.md`) ; structure du dépôt takatakca/takatak-v1 lue via le connecteur GitHub en lecture seule (tête main `db4140f6`, dossier `docs/` existant, aucune doc carrousel/*Show products* dans v1 — recherche code = 0 résultat).
- **PENDANT (2026-11-19, Taktak)** : recherche web, sources Meta officielles d'abord (titres du centre d'aide et doc développeur *Product extensions*), recoupées par des guides qui les citent avec captures d'Ads Manager. Conclusion consignée sans embellir : l'en-tête « More from [Page] » = affichage fil/Boutique du catalogue ; le mécanisme contrôlable documenté = *Show products* (automatique, non garanti) ; les rendus garantis = Collection et Carrousel. Document rédigé en français, règles de Matt intégrées (§8).
- **APRÈS (2026-11-19, Taktak)** : dépôt Drive et préparation GitHub — voir le rapport de livraison de la passe (fileId Drive + md5 vérifié inscrits au registre et au fichier maître par l'agent principal). **Rien poussé sur GitHub par la présente passe** : le fichier est prêt pour `docs/FORMAT-IMAGES-SOUS-ANNONCE-FACEBOOK.md` dans takatakca/takatak-v1, en attente de la carte d'approbation lancée par l'agent principal. Aucune publication Facebook, aucun envoi externe, aucun paiement.

— **Taktak, 2026-11-19**
