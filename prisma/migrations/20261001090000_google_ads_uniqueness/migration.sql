-- One connected Google Ads account per workspace client.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_google_ads_account_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'google_ads'
    AND "externalAccountId" IS NOT NULL;

-- One connected Google Ads account per Google Ads connection.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_google_ads_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'google_ads'
    AND "providerConnectionId" IS NOT NULL;
