-- Repair production schema drift: Prisma expects responsePayload on
-- source_synchronization_events and Rentauto payment projection writes it.
ALTER TABLE public.source_synchronization_events
  ADD COLUMN IF NOT EXISTS "responsePayload" jsonb;
