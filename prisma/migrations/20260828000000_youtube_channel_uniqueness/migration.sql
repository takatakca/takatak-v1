-- One connected YouTube channel per workspace client.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_youtube_channel_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'youtube'
    AND "externalAccountId" IS NOT NULL;

-- One connected YouTube channel per Google connection.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_youtube_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'youtube'
    AND "providerConnectionId" IS NOT NULL;
