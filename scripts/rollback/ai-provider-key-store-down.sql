-- ROLLBACK: AI provider keys (migration 20261009100000_ai_provider_key_store).
--
-- WARNING: this DROPS every saved AI provider key. The providers' own keys are
-- not affected; they must be entered again after re-applying the migration.
-- Runs in one transaction: it either fully applies or changes nothing.

BEGIN;

DROP TABLE IF EXISTS "ai_provider_credentials";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261009100000_ai_provider_key_store';

COMMIT;
