-- One connected blog host per workspace client.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_blog_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'blog'
    AND "externalAccountId" IS NOT NULL;

-- One connected blog per blog connection.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_blog_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'blog'
    AND "providerConnectionId" IS NOT NULL;
