-- Additive: retain the unique email index; PostgreSQL permits multiple NULLs.
ALTER TABLE "profiles" ALTER COLUMN "email" DROP NOT NULL;
