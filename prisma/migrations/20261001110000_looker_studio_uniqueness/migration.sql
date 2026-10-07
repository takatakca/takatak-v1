-- One connected Looker Studio report per workspace client.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_looker_studio_report_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'looker_studio'
    AND "externalAccountId" IS NOT NULL;

-- One connected Looker Studio report per Looker Studio connection.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_looker_studio_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'looker_studio'
    AND "providerConnectionId" IS NOT NULL;
