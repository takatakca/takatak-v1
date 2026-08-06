-- RenameForeignKey
ALTER TABLE "social_credentials" RENAME CONSTRAINT "social_credentials_connectionId_fkey" TO "social_credentials_connectionId_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "social_oauth_states" RENAME CONSTRAINT "social_oauth_states_businessBrandId_fkey" TO "social_oauth_states_businessBrandId_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "social_oauth_states" RENAME CONSTRAINT "social_oauth_states_connectionId_fkey" TO "social_oauth_states_connectionId_clientId_businessBrandId__fkey";

-- RenameForeignKey
ALTER TABLE "social_provider_connections" RENAME CONSTRAINT "social_provider_connections_businessBrandId_fkey" TO "social_provider_connections_businessBrandId_clientId_fkey";
