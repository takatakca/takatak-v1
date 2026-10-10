-- One connected Twitch channel per workspace client.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_twitch_account_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'twitch'
    AND "externalAccountId" IS NOT NULL;

-- One connected Twitch channel per Twitch connection.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_twitch_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'twitch'
    AND "providerConnectionId" IS NOT NULL;
