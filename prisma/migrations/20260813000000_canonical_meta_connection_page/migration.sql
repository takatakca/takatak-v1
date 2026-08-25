-- Canonical Meta connection + selected Facebook Page uniqueness.
-- Policy: one live shell per (client, brand, provider); one active Page assignment
-- per brand; one connected Facebook Page per provider connection.
-- When duplicate live rows disagree on Meta user or selected Page, do NOT guess —
-- mark BusinessBrand.requiresMetaPageReselection and deactivate all live Meta shells.

-- 1) Brand flag for forced Page reselection after ambiguous duplicates.
ALTER TABLE "business_brands"
  ADD COLUMN IF NOT EXISTS "requiresMetaPageReselection" BOOLEAN NOT NULL DEFAULT false;

-- 2) Mark brands with conflicting Meta shells (disagreeing subjects or selected Pages).
WITH live_meta AS (
  SELECT
    spc."id",
    spc."clientId",
    spc."businessBrandId",
    spc."externalSubjectId",
    spc."status",
    spc."updatedAt"
  FROM "social_provider_connections" spc
  WHERE spc."provider" = 'meta'
    AND spc."status" IN ('pending_authorization', 'authorized', 'connected')
),
brand_groups AS (
  SELECT
    "clientId",
    "businessBrandId",
    COUNT(*)::int AS live_count,
    COUNT(DISTINCT NULLIF("externalSubjectId", ''))::int AS subject_count
  FROM live_meta
  GROUP BY "clientId", "businessBrandId"
  HAVING COUNT(*) > 1
),
selected_pages AS (
  SELECT
    sa."providerConnectionId" AS connection_id,
    sa."id" AS account_id,
    sa."externalAccountId"
  FROM "social_accounts" sa
  WHERE sa."platform" = 'facebook'
    AND sa."status" = 'connected'
    AND sa."accessStatus" = 'selected'
    AND sa."providerConnectionId" IS NOT NULL
),
conflict_brands AS (
  SELECT
    bg."clientId",
    bg."businessBrandId"
  FROM brand_groups bg
  WHERE bg.subject_count > 1
     OR (
       SELECT COUNT(*)::int
       FROM selected_pages sp
       INNER JOIN live_meta lm ON lm."id" = sp.connection_id
       WHERE lm."clientId" = bg."clientId"
         AND lm."businessBrandId" = bg."businessBrandId"
     ) > 1
)
UPDATE "business_brands" bb
SET "requiresMetaPageReselection" = true
FROM conflict_brands cb
WHERE bb."id" = cb."businessBrandId"
  AND bb."clientId" = cb."clientId";

-- 3) For conflict brands: deactivate assignments, demote accounts, revoke credentials, disconnect shells.
WITH conflict_brands AS (
  SELECT "id" AS brand_id, "clientId"
  FROM "business_brands"
  WHERE "requiresMetaPageReselection" = true
),
conflict_connections AS (
  SELECT spc."id"
  FROM "social_provider_connections" spc
  INNER JOIN conflict_brands cb
    ON cb.brand_id = spc."businessBrandId"
   AND cb."clientId" = spc."clientId"
  WHERE spc."provider" = 'meta'
    AND spc."status" IN ('pending_authorization', 'authorized', 'connected')
),
conflict_accounts AS (
  SELECT sa."id"
  FROM "social_accounts" sa
  WHERE sa."providerConnectionId" IN (SELECT "id" FROM conflict_connections)
     OR (
       sa."businessBrandId" IN (SELECT brand_id FROM conflict_brands)
       AND sa."platform" IN ('facebook', 'instagram', 'threads')
       AND sa."status" = 'connected'
     )
)
UPDATE "social_brand_account_assignments" sbaa
SET
  "status" = 'inactive',
  "unassignedAt" = COALESCE(sbaa."unassignedAt", NOW()),
  "updatedAt" = NOW()
WHERE sbaa."status" = 'active'
  AND sbaa."socialAccountId" IN (SELECT "id" FROM conflict_accounts);

WITH conflict_brands AS (
  SELECT "id" AS brand_id, "clientId"
  FROM "business_brands"
  WHERE "requiresMetaPageReselection" = true
),
conflict_connections AS (
  SELECT spc."id"
  FROM "social_provider_connections" spc
  INNER JOIN conflict_brands cb
    ON cb.brand_id = spc."businessBrandId"
   AND cb."clientId" = spc."clientId"
  WHERE spc."provider" = 'meta'
    AND spc."status" IN ('pending_authorization', 'authorized', 'connected')
),
conflict_accounts AS (
  SELECT sa."id"
  FROM "social_accounts" sa
  WHERE sa."providerConnectionId" IN (SELECT "id" FROM conflict_connections)
)
UPDATE "social_accounts" sa
SET
  "status" = 'not_connected',
  "accessStatus" = 'available',
  "updatedAt" = NOW()
WHERE sa."id" IN (SELECT "id" FROM conflict_accounts);

WITH conflict_brands AS (
  SELECT "id" AS brand_id, "clientId"
  FROM "business_brands"
  WHERE "requiresMetaPageReselection" = true
),
conflict_connections AS (
  SELECT spc."id"
  FROM "social_provider_connections" spc
  INNER JOIN conflict_brands cb
    ON cb.brand_id = spc."businessBrandId"
   AND cb."clientId" = spc."clientId"
  WHERE spc."provider" = 'meta'
    AND spc."status" IN ('pending_authorization', 'authorized', 'connected')
)
UPDATE "social_credentials" sc
SET
  "status" = 'revoked',
  "statusChangedAt" = NOW(),
  "updatedAt" = NOW()
WHERE sc."connectionId" IN (SELECT "id" FROM conflict_connections);

WITH conflict_brands AS (
  SELECT "id" AS brand_id, "clientId"
  FROM "business_brands"
  WHERE "requiresMetaPageReselection" = true
)
UPDATE "social_provider_connections" spc
SET
  "status" = 'disconnected',
  "disconnectedAt" = COALESCE(spc."disconnectedAt", NOW()),
  "connectedAt" = NULL,
  "updatedAt" = NOW()
WHERE spc."provider" = 'meta'
  AND spc."status" IN ('pending_authorization', 'authorized', 'connected')
  AND EXISTS (
    SELECT 1 FROM conflict_brands cb
    WHERE cb.brand_id = spc."businessBrandId"
      AND cb."clientId" = spc."clientId"
  );

-- 4) Agreeing duplicates: keep one canonical live shell, demote the rest.
-- Prefer: connected + has selected page > connected > authorized > pending; then newest updatedAt.
WITH live_meta AS (
  SELECT
    spc."id",
    spc."clientId",
    spc."businessBrandId",
    spc."externalSubjectId",
    spc."status",
    spc."updatedAt",
    EXISTS (
      SELECT 1
      FROM "social_accounts" sa
      WHERE sa."providerConnectionId" = spc."id"
        AND sa."platform" = 'facebook'
        AND sa."status" = 'connected'
        AND sa."accessStatus" = 'selected'
    ) AS has_selected_page
  FROM "social_provider_connections" spc
  WHERE spc."provider" = 'meta'
    AND spc."status" IN ('pending_authorization', 'authorized', 'connected')
),
ranked AS (
  SELECT
    lm.*,
    ROW_NUMBER() OVER (
      PARTITION BY lm."clientId", lm."businessBrandId"
      ORDER BY
        CASE
          WHEN lm."status" = 'connected' AND lm.has_selected_page THEN 0
          WHEN lm."status" = 'connected' THEN 1
          WHEN lm."status" = 'authorized' THEN 2
          ELSE 3
        END,
        lm."updatedAt" DESC,
        lm."id" DESC
    ) AS rn
  FROM live_meta lm
),
losers AS (
  SELECT "id"
  FROM ranked
  WHERE rn > 1
)
UPDATE "social_credentials" sc
SET
  "status" = 'revoked',
  "statusChangedAt" = NOW(),
  "updatedAt" = NOW()
WHERE sc."connectionId" IN (SELECT "id" FROM losers);

WITH live_meta AS (
  SELECT
    spc."id",
    spc."clientId",
    spc."businessBrandId",
    spc."status",
    spc."updatedAt",
    EXISTS (
      SELECT 1
      FROM "social_accounts" sa
      WHERE sa."providerConnectionId" = spc."id"
        AND sa."platform" = 'facebook'
        AND sa."status" = 'connected'
        AND sa."accessStatus" = 'selected'
    ) AS has_selected_page
  FROM "social_provider_connections" spc
  WHERE spc."provider" = 'meta'
    AND spc."status" IN ('pending_authorization', 'authorized', 'connected')
),
ranked AS (
  SELECT
    lm.*,
    ROW_NUMBER() OVER (
      PARTITION BY lm."clientId", lm."businessBrandId"
      ORDER BY
        CASE
          WHEN lm."status" = 'connected' AND lm.has_selected_page THEN 0
          WHEN lm."status" = 'connected' THEN 1
          WHEN lm."status" = 'authorized' THEN 2
          ELSE 3
        END,
        lm."updatedAt" DESC,
        lm."id" DESC
    ) AS rn
  FROM live_meta lm
),
losers AS (
  SELECT "id"
  FROM ranked
  WHERE rn > 1
)
UPDATE "social_accounts" sa
SET
  "status" = 'not_connected',
  "accessStatus" = 'available',
  "updatedAt" = NOW()
WHERE sa."providerConnectionId" IN (SELECT "id" FROM losers)
  AND sa."status" = 'connected';

WITH live_meta AS (
  SELECT
    spc."id",
    spc."clientId",
    spc."businessBrandId",
    spc."status",
    spc."updatedAt",
    EXISTS (
      SELECT 1
      FROM "social_accounts" sa
      WHERE sa."providerConnectionId" = spc."id"
        AND sa."platform" = 'facebook'
        AND sa."status" = 'connected'
        AND sa."accessStatus" = 'selected'
    ) AS has_selected_page
  FROM "social_provider_connections" spc
  WHERE spc."provider" = 'meta'
    AND spc."status" IN ('pending_authorization', 'authorized', 'connected')
),
ranked AS (
  SELECT
    lm.*,
    ROW_NUMBER() OVER (
      PARTITION BY lm."clientId", lm."businessBrandId"
      ORDER BY
        CASE
          WHEN lm."status" = 'connected' AND lm.has_selected_page THEN 0
          WHEN lm."status" = 'connected' THEN 1
          WHEN lm."status" = 'authorized' THEN 2
          ELSE 3
        END,
        lm."updatedAt" DESC,
        lm."id" DESC
    ) AS rn
  FROM live_meta lm
),
losers AS (
  SELECT "id"
  FROM ranked
  WHERE rn > 1
)
UPDATE "social_provider_connections" spc
SET
  "status" = 'disconnected',
  "disconnectedAt" = COALESCE(spc."disconnectedAt", NOW()),
  "connectedAt" = NULL,
  "updatedAt" = NOW()
WHERE spc."id" IN (SELECT "id" FROM losers);

-- 5) Extra active assignments per brand (keep none when >1 — do not guess).
WITH active_per_brand AS (
  SELECT
    "businessBrandId",
    COUNT(*)::int AS active_count
  FROM "social_brand_account_assignments"
  WHERE "status" = 'active'
  GROUP BY "businessBrandId"
  HAVING COUNT(*) > 1
)
UPDATE "business_brands" bb
SET "requiresMetaPageReselection" = true
FROM active_per_brand apb
WHERE bb."id" = apb."businessBrandId";

WITH multi_active AS (
  SELECT "businessBrandId"
  FROM "social_brand_account_assignments"
  WHERE "status" = 'active'
  GROUP BY "businessBrandId"
  HAVING COUNT(*) > 1
)
UPDATE "social_brand_account_assignments" sbaa
SET
  "status" = 'inactive',
  "unassignedAt" = COALESCE(sbaa."unassignedAt", NOW()),
  "updatedAt" = NOW()
WHERE sbaa."status" = 'active'
  AND sbaa."businessBrandId" IN (SELECT "businessBrandId" FROM multi_active);

-- Demote connected facebook pages that lost active assignment on multi-active brands.
WITH multi_active AS (
  SELECT "id" AS brand_id
  FROM "business_brands"
  WHERE "requiresMetaPageReselection" = true
)
UPDATE "social_accounts" sa
SET
  "status" = 'not_connected',
  "accessStatus" = 'available',
  "updatedAt" = NOW()
WHERE sa."platform" = 'facebook'
  AND sa."status" = 'connected'
  AND sa."businessBrandId" IN (SELECT brand_id FROM multi_active);

WITH multi_active AS (
  SELECT "id" AS brand_id, "clientId"
  FROM "business_brands"
  WHERE "requiresMetaPageReselection" = true
)
UPDATE "social_provider_connections" spc
SET
  "status" = CASE
    WHEN spc."status" = 'connected' THEN 'authorized'::"SocialConnectionStatus"
    ELSE spc."status"
  END,
  "connectedAt" = NULL,
  "updatedAt" = NOW()
WHERE spc."provider" = 'meta'
  AND spc."status" = 'connected'
  AND EXISTS (
    SELECT 1 FROM multi_active ma
    WHERE ma.brand_id = spc."businessBrandId"
      AND ma."clientId" = spc."clientId"
  );

-- 6) Extra connected facebook pages per connection → keep selected if unique, else demote all connected on that connection.
WITH per_connection AS (
  SELECT
    "providerConnectionId",
    COUNT(*)::int AS connected_count,
    COUNT(*) FILTER (
      WHERE "accessStatus" = 'selected'
    )::int AS selected_count
  FROM "social_accounts"
  WHERE "platform" = 'facebook'
    AND "status" = 'connected'
    AND "providerConnectionId" IS NOT NULL
  GROUP BY "providerConnectionId"
  HAVING COUNT(*) > 1
),
ambiguous AS (
  SELECT "providerConnectionId"
  FROM per_connection
  WHERE selected_count <> 1
)
UPDATE "social_accounts" sa
SET
  "status" = 'not_connected',
  "accessStatus" = 'available',
  "updatedAt" = NOW()
WHERE sa."providerConnectionId" IN (SELECT "providerConnectionId" FROM ambiguous)
  AND sa."platform" = 'facebook'
  AND sa."status" = 'connected';

WITH per_connection AS (
  SELECT
    "providerConnectionId",
    COUNT(*)::int AS connected_count,
    COUNT(*) FILTER (
      WHERE "accessStatus" = 'selected'
    )::int AS selected_count
  FROM "social_accounts"
  WHERE "platform" = 'facebook'
    AND "status" = 'connected'
    AND "providerConnectionId" IS NOT NULL
  GROUP BY "providerConnectionId"
  HAVING COUNT(*) > 1
),
clear_winners AS (
  SELECT "providerConnectionId"
  FROM per_connection
  WHERE selected_count = 1
)
UPDATE "social_accounts" sa
SET
  "status" = 'not_connected',
  "accessStatus" = 'available',
  "updatedAt" = NOW()
WHERE sa."providerConnectionId" IN (SELECT "providerConnectionId" FROM clear_winners)
  AND sa."platform" = 'facebook'
  AND sa."status" = 'connected'
  AND sa."accessStatus" <> 'selected';

-- 7) Enforce uniqueness going forward.
CREATE UNIQUE INDEX IF NOT EXISTS "spc_one_live_per_brand_provider_key"
  ON "social_provider_connections"("clientId", "businessBrandId", "provider")
  WHERE "status" IN ('pending_authorization', 'authorized', 'connected');

CREATE UNIQUE INDEX IF NOT EXISTS "sbaa_one_active_per_brand_key"
  ON "social_brand_account_assignments"("businessBrandId")
  WHERE "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_facebook_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'facebook'
    AND "providerConnectionId" IS NOT NULL;
