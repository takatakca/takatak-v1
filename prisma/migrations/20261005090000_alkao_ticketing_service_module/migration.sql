-- Register ALKAO Ticketing as an optional TAKATAK service module. A Client sees
-- the "ALKAO — Billetterie" menu only with a ticketing ServiceInstance that is
-- active or pending setup. ALKAO enforces its own entitlement server-side.
ALTER TYPE "ServiceType" ADD VALUE IF NOT EXISTS 'ticketing';
