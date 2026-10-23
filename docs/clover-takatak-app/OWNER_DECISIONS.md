# Décisions du propriétaire / Owner decisions

Pour chaque décision : la question, les options, et **l'option recommandée** (★). Répondez simplement « D1 : ★ » ou
« D1 : B » dans la pull request.

For each decision: the question, the options, and **the recommended option** (★). Answer "D1: ★" or "D1: B" in the
pull request.

Les décisions D1 à D10 bloquent le démarrage. / D1–D10 block the start.

---

## D1 — Nom de l'application / App name

**FR.** Le nom ne peut pas contenir « Clover », ni « Google », « Facebook » ou « Instagram » (règles de marque). Il doit
être différent de « TAKATAK Food Hub » et « TAKATAK Phone AI ».
- A. « TAKATAK » tout court (simple, mais trop proche des deux autres apps et peu clair pour Clover).
- ★ B. **« TAKATAK Présence »** (dit ce que fait l'app : votre présence en ligne; se lit en français et en anglais).
- C. « TAKATAK Marketing ».

**EN.** The name cannot contain "Clover", "Google", "Facebook" or "Instagram" (brand rules) and must differ from the two
other apps. A: "TAKATAK" alone; ★ B: **"TAKATAK Présence"**; C: "TAKATAK Marketing".

## D2 — Nouvelle app ou réutiliser le brouillon « on2go » / New app or reuse the "on2go" draft

**FR.** ★ A. **Créer une nouvelle app** (Web, App Market, Canada, FR-CA + EN-CA) et laisser le brouillon
`N4NYCJCZ17FF4` intact. B. Réutiliser le brouillon (type Android & Web, pays et catégorie inconnus : plus de risques).

**EN.** ★ A. **Create a new app** (Web, App Market, Canada, FR-CA + EN-CA); leave draft `N4NYCJCZ17FF4` untouched.
B. Reuse the draft (Android & Web type, unknown country and category: more risk).

## D3 — Où tourne l'app / Where the app runs

**FR.** ★ A. **Dans takatak-v1 (takatak.ca)**, avec le code Clover de Food Hub copié et adapté. Données séparées de Food
Hub. B. Comme 3e app dans le serveur Food Hub (réutilise tel quel, mais domaine on2go, deux systèmes, séparation moins
nette). Détails : [ARCHITECTURE.md](ARCHITECTURE.md) §2.

**EN.** ★ A. **In takatak-v1 (takatak.ca)**, with Food Hub's Clover code ported. B. As a third app in the Food Hub
server.

## D4 — Adresse de l'app (Site URL) / App address (Site URL)

**FR.** Elle doit être finale avant la soumission (un changement après approbation = nouvelle révision).
★ A. **`https://takatak.ca/clover/...`** (site déjà en ligne, pages légales au même endroit). B. Sous-domaine
`app.takatak.ca` (plus propre à long terme, mais à créer et à sécuriser).

**EN.** Must be final before submission. ★ A. **`https://takatak.ca/clover/...`**. B. `app.takatak.ca`.

## D5 — Prix / Pricing

**FR.** Clover garde 30 %. ★ A. **Essai gratuit de 14 jours, puis 50 $ CA/mois** par établissement Clover (Google +
Facebook + Instagram inclus), **+ 15 $ CA/mois par marque supplémentaire** (événement mesuré Clover), comme Food Hub.
Pas de crédits IA payants au début. B. 50 $/mois tout compris, sans extra. C. Gratuit au début pour gagner des avis.
Le prix d'un événement mesuré ne change ensuite qu'avec l'accord de Clover; un changement de prix ne touche pas les
clients déjà installés. Devise CAD à confirmer avec Clover.

**EN.** ★ A. **14-day trial, then CAD $50/month** per Clover merchant (Google + Facebook + Instagram), **+ CAD $15/month
per extra brand** (Clover metered event); no paid AI credits at first. B. $50 all-in. C. Free at first.

## D6 — Quels canaux d'abord / Which channels first

**FR.** ★ A. **Google Business Profile + Facebook en premier**, Instagram dès que Meta approuve la permission de
publication; Pinterest, Threads, TikTok plus tard (P2). On soumet à Clover seulement quand au moins un canal marche
vraiment. B. Attendre que les trois marchent avant de soumettre. C. Facebook seul d'abord (si Google tarde).

**EN.** ★ A. **Google + Facebook first**, Instagram once Meta approves publishing; others in P2. Submit to Clover only when
at least one channel really works.

## D7 — Slogan / Tagline

**FR.** « Le premier backend IA » ne peut pas être prouvé (des concurrents existent) : risque Clover et Loi sur la
concurrence. ★ A. **« Votre resto, partout où on vous cherche. »** + « Un seul tableau de bord IA pour votre présence en
ligne : menu, heures et publications, connectés à Clover. » B. Autre phrase du propriétaire, sans « premier », « seul »,
« n° 1 » ni « garanti ». Voir [MARKET_AND_CLAIMS.md](MARKET_AND_CLAIMS.md).

**EN.** "The first AI backend" cannot be proven. ★ A. **"Your restaurant, everywhere people look."** + "One AI dashboard
for your online presence: menu, hours and posts, connected to Clover."

## D8 — Responsable de la protection des renseignements personnels / Person in charge of personal information

**FR.** La Loi 25 (art. 3.1) en fait la personne qui a la plus haute autorité, sauf délégation écrite. Son titre et ses
coordonnées sont publiés sur le site. ★ A. **Matthieu (président), avec une adresse de rôle** (pas une adresse
personnelle) sur takatak.ca/privacy. B. Déléguer par écrit à une autre personne ou à un service externe.

**EN.** Law 25 s.3.1: the highest authority by default, unless delegated in writing; title and contact published.
★ A. **Matthieu (president), with a role address** on takatak.ca/privacy. B. Delegate in writing.

## D9 — Entité légale / Legal entity

**FR.** La même entité doit être : le développeur du compte Clover, le concédant de la licence (EULA), l'entreprise
vérifiée chez Meta, l'organisation agence chez Google. ★ A. **L'entité qui détient déjà le compte développeur Clover**
(à confirmer : Quadro Holdings Ltée ou une société d'exploitation TAKATAK). B. Créer d'abord une société d'exploitation
TAKATAK (plus long). À valider avec l'avocat.

**EN.** One entity for Clover developer, EULA licensor, Meta verified business, Google agency organization. ★ A. **The
entity that already holds the Clover developer account.** B. Create an operating company first.

## D10 — Où sont les données / Data region

**FR.** La base takatak-v1 est en Irlande (`eu-west-1`); Food Hub est au Canada (`ca-central-1`). La Loi 25 (art. 17)
demande une évaluation (EFVP) et une entente écrite avant d'envoyer des renseignements personnels hors Québec. ★ A.
**Faire l'EFVP maintenant et prévoir le déménagement des données venant de Clover au Canada (`ca-central-1`) avant la
soumission.** B. Rester en Irlande avec EFVP et ententes (possible, mais à défendre à chaque client). C. Déménager toute la
base takatak-v1 tout de suite (gros chantier).

**EN.** ★ A. **PIA now; move Clover-sourced data to Canada (`ca-central-1`) before submission.** B. Stay in Ireland with a
PIA and agreements. C. Move the whole takatak-v1 database now.

---

## D11 — Publication automatique / Auto-publishing

**FR.** ★ A. **Jamais de publication sans approbation en P1 et P2.** Synchronisation automatique permise seulement pour le
menu et les heures (avec consentement « synchro »). Auto-publication des publications en P3, sur option explicite et
révocable. B. Auto-publication dès le début (risque de refus Clover et Google).

**EN.** ★ A. **No post without approval in P1–P2**; automatic sync only for menu and hours (with "sync" consent); opt-in
auto-posting in P3. B. Auto-post from day one (rejection risk).

## D12 — Images IA / AI images

**FR.** ★ A. **L'IA écrit le texte; les photos sont de vraies photos du restaurant.** Aucune image IA présentée comme un
vrai plat. B. Images IA permises avec étiquette « IA » (plus tard, après avis de l'avocat).

**EN.** ★ A. **AI writes text; photos are the restaurant's real photos.** B. AI images allowed with an "AI" label (later,
after legal advice).

## D13 — « Prendre les entreprises des autres » : la limite / "Take other businesses": the boundary

**FR.** Clover interdit d'utiliser ses données dans une autre place de marché, un répertoire ou pour notre propre
marketing; Google interdit de réclamer des fiches sans consentement. ★ A. **Tout est sur invitation du commerçant : il
installe, il consent, il garde la propriété de ses comptes.** Un répertoire TAKATAK public, s'il existe un jour, se
remplit seulement avec un accord séparé (hors données Clover) ou l'accord écrit de Clover. B. Utiliser les données Clover
pour QMAPS / un répertoire (non recommandé : contraire aux règles Clover).

**EN.** ★ A. **Everything opt-in; the merchant installs, consents and keeps ownership.** A public TAKATAK directory only from
a separate agreement (no Clover data) or Clover's written OK. B. Use Clover data in QMAPS / a directory (not
recommended).

## D14 — Clients Stripe existants qui installent l'app Clover / Existing Stripe customers who install the Clover app

**FR.** ★ A. **Demander à Clover par écrit; en attendant, aucun paiement Stripe pour les espaces venus de Clover.** B.
Laisser les deux facturations (risque de retrait de l'app).

**EN.** ★ A. **Ask Clover in writing; meanwhile no Stripe payments for Clover-sourced workspaces.** B. Keep both (removal
risk).

## D15 — Quand soumettre à Clover / When to submit to Clover

**FR.** ★ A. **Construire et tester dans le bac à sable maintenant; soumettre après le premier retour de Clover sur Food Hub
ou Phone AI** (pour corriger les pages légales une seule fois). B. Soumettre dès que P1 est prêt.

**EN.** ★ A. **Build and test in sandbox now; submit after Clover's first feedback on Food Hub or Phone AI.** B. Submit as
soon as P1 is ready.

## D16 — Marque de commerce « TAKATAK » / "TAKATAK" trademark

**FR.** ★ A. **Déposer « TAKATAK » à l'Office de la propriété intellectuelle du Canada** (protège le nom; aide pour
l'affichage au Québec, art. 58.1 de la Charte). B. Plus tard.

**EN.** ★ A. **File "TAKATAK" with the Canadian Intellectual Property Office.** B. Later.

## D17 — Restaurants pilotes / Pilot restaurants

**FR.** ★ A. **Nos propres restaurants réels, un canal à la fois; Po Poulet NDG exclu (liste de blocage).** B. Un
restaurant client ami dès le début.

**EN.** ★ A. **Our own real restaurants, one channel at a time; Po Poulet NDG excluded (hard block list).** B. A friendly
client restaurant from the start.

## D18 — Avocat / Lawyer

**FR.** ★ A. **Un avocat du Québec en droit des technologies et de la vie privée, mandat limité** aux 16 questions de
[LEGAL_QUEBEC_CANADA.md](LEGAL_QUEBEC_CANADA.md) §13 + relecture EULA, politique de confidentialité et entente de
traitement. B. Modèles en ligne sans avocat (Clover refuse les textes génériques).

**EN.** ★ A. **A Québec technology and privacy lawyer, limited mandate** (16 questions + EULA, privacy policy, DPA review).
B. Templates without a lawyer (Clover rejects generic texts).

## D19 — Question sur les apps existantes / Question about the existing apps

**FR.** Food Hub documente que Phone AI utilise le jeton de Phone AI, puis celui de Food Hub en secours. Les règles Clover
(art. 18.2) limitent les données d'une app à cette app. ★ A. **Poser la question à Clover dans le même message que les
autres questions.** B. Ne rien demander.

**EN.** Phone AI falls back to Food Hub's token. ★ A. **Ask Clover in the same message as the other questions.** B. Do
not ask.
