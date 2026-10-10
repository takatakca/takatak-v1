-- One connected website host per workspace client.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_web_site_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'web'
    AND "externalAccountId" IS NOT NULL;

-- One connected website per web connection.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_web_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'web'
    AND "providerConnectionId" IS NOT NULL;
