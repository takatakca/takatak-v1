-- One connected X account per workspace client.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_x_account_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'x'
    AND "externalAccountId" IS NOT NULL;

-- One connected X account per X connection.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_x_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'x'
    AND "providerConnectionId" IS NOT NULL;
