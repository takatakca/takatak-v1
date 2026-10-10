-- A verified mobile number is enough to own a TAKATAK identity.
-- Existing rows keep their email addresses. New phone-only profiles store NULL.
ALTER TABLE "profiles" ALTER COLUMN "email" DROP NOT NULL;
