-- social_free is not a supported catalog code. Preserve the legacy lifecycle
-- status while moving every row to the canonical zero-entitlement plan.
UPDATE "client_subscriptions"
SET
  "planCode" = 'social_unsubscribed',
  "planName" = 'No Social subscription',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "planCode" = 'social_free';
