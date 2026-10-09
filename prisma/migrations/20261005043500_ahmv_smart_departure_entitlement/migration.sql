-- AHMV Smart Departure entitlement.
-- Keep Parent Essential unchanged; this capability belongs to the planned
-- Parent Premium tier until product/provider release gates are completed.

INSERT INTO "product_entitlements"
  ("id","productId","code","name","active","updatedAt")
SELECT
  gen_random_uuid(),
  product."id",
  'smart_departure',
  'Smart departure',
  true,
  CURRENT_TIMESTAMP
FROM "product_catalog" product
WHERE product."code" = 'ahmv'
  AND NOT EXISTS (
    SELECT 1
    FROM "product_entitlements" existing
    WHERE existing."productId" = product."id"
      AND existing."code" = 'smart_departure'
  );

INSERT INTO "product_plan_entitlements" ("planId","entitlementId")
SELECT plan."id", entitlement."id"
FROM "product_plans" plan
JOIN "product_catalog" product ON product."id" = plan."productId"
JOIN "product_entitlements" entitlement
  ON entitlement."productId" = product."id"
WHERE product."code" = 'ahmv'
  AND plan."code" = 'parent_premium'
  AND entitlement."code" = 'smart_departure'
ON CONFLICT ("planId","entitlementId") DO NOTHING;
