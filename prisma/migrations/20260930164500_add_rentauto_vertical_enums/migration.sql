-- Register Rentauto as a first-class TAKATAK vertical without changing
-- existing service/provider values.
ALTER TYPE "ServiceType" ADD VALUE IF NOT EXISTS 'rentauto';
ALTER TYPE "Provider" ADD VALUE IF NOT EXISTS 'rentauto';
