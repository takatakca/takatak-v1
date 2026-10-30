# ON2GO et Food Hub sur l'API maître · ON2GO and Food Hub on the master API

Tranche 6 du plan ON2GO (on2goca `docs/ON2GO_APP_BLUEPRINT.md`) : takatak-v1 reste l'autorité d'identité et de
facturation ; on2go.ca (clients) et ON2GO Hub / Food Hub (restaurants, commandes) lui parlent par l'API maître, chacun
avec **sa clé et sa source**. La portée 1LV n'a pas bougé. Aucune migration.

## Portées · Scopes (`src/lib/integrations/master-api/scope.ts`)

| Portée | Clé (env) | Source annoncée | Routes |
|---|---|---|---|
| `1lv` | `TAKATAK_1LV_API_KEY` | `1lv` | toutes celles d'avant, inchangées |
| `on2go` | `TAKATAK_ON2GO_API_KEY` | `on2go` | `/api/v1/auth/otp/send`, `/api/v1/auth/otp/verify`, `/api/v1/identity/resolve-person`, `/api/v1/events` |
| `foodhub` | `TAKATAK_FOODHUB_API_KEY` | `foodhub` | les quatre ci-dessus + `/api/v1/identity/resolve-merchant` + `/api/v1/merchants/entitlements` |

- Une clé n'ouvre jamais une autre portée : la clé ON2GO sur une route 1LV seulement → 401, même si elle est juste.
- Le `source_application` d'un corps doit être **le nom de la portée** de la clé ; sinon 400 « Unsupported source
  application ». Les lignes `source_profiles` / `source_merchants` disent donc toujours qui les a créées.
- Clé absente ou < 32 caractères = portée non configurée (503 sur ses routes), jamais une clé faible.
- Un client on2go.ca n'a **pas d'espace de travail** : `otp/verify` crée ou relie une `MasterIdentity` (téléphone
  vérifié) sans `Client`, sans `Profile` nouveau. Un restaurateur, lui, reste un `Client` avec son forfait.

## Pont lancement / échange pour on2go.ca · Launch / exchange bridge (contrat C3)

Modèle AHMV (`experience_launch_codes`, sans migration) : `src/lib/integrations/on2go/experience-access.ts`.

1. `GET /api/experiences/on2go/launch` (session TAKATAK) → code à usage unique (90 s), redirection 303 vers
   `ON2GO_EXPERIENCE_CALLBACK_URL?code=…` (https obligatoire). Pas d'espace de travail créé.
2. `POST /api/experiences/on2go/exchange` `{ "code" }` avec `Authorization: Bearer <TAKATAK_ON2GO_SERVICE_TOKEN>`
   (jeton propre à ON2GO Hub, ≥ 32 caractères) → `{ ok, session: { identityId, displayName, phone, email, locale,
   product: "on2go", entitlement: "on2go_customer", expiresAt } }` (10 min). Téléphone et courriel seulement s'ils sont
   vérifiés. Le code est consommé puis l'identité re-vérifiée : compte suspendu = pas de session.
3. `POST /api/experiences/on2go/introspect` `{ "identityId" }` (même jeton) → `{ ok, active, … }`.

Qui échange : on2go.ca est statique ; c'est ON2GO Hub (Food Hub) qui tient le jeton et fait l'échange serveur à
serveur, puis pose sa propre session client (tâche 72 de foodhubca).

## Droits d'un marchand · Merchant entitlements (contrat C4)

`POST /api/v1/merchants/entitlements` (`foodhub` ou `1lv`) `{ "source_application": "foodhub", "local_vendor_id": "…" }`
→ `{ ok, known, master_merchant_id, store_name, store_slug, marketplace_status, subscription_status, subscription_plan,
synchronized_at }`. Ce sont les champs que les événements `merchant.*` ont enregistrés pour **cette** source ; le lien
`MasterMerchant` ↔ `Client` (forfait Stripe réel) n'existe pas dans le schéma : l'ajouter demande une migration, donc
l'accord du propriétaire.

## Événements · Events (contrat C5)

`POST /api/v1/events` accepte maintenant les trois portées ; `Idempotency-Key` = `event_id`, corps ≤ 100 Ko,
`source_application` = la portée. Les commandes (`order.*`) retrouvent le client sous la **même** source
(`customer_local_id` de cette application), jamais sous celle d'une autre.

## Variables · Environment

| Variable | Rôle |
|---|---|
| `TAKATAK_ON2GO_API_KEY` | clé de la portée `on2go` (on2go.ca via ON2GO Hub) |
| `TAKATAK_FOODHUB_API_KEY` | clé de la portée `foodhub` (ON2GO Hub / Food Hub) |
| `TAKATAK_ON2GO_SERVICE_TOKEN` | jeton du pont lancement / échange (ON2GO Hub seulement) |
| `ON2GO_EXPERIENCE_CALLBACK_URL` | page https qui reçoit `?code=` (ex. `https://on2go.ca/connexion/`) |

`npm run preflight` vérifie leur forme (≥ 32 caractères, https). Jamais la même valeur pour deux variables.

## Vérification · Tests

`npm run qa:on2go-master-api` (`scripts/on2go-master-api-tests.ts`, sans base) : clés par portée, 1LV inchangé,
sources liées aux portées, jeton et rappel du pont, identité utilisable.

— signé : Claude Fable 5.1 (session on2go front-page) @ Claude Code desktop · 2026-10-30 06:40
