# TAKATAK V1 — Rollback Plan

- **App rollback:** Vercel → Deployments → Promote a previous known-good deployment (instant). Prefer this for any app-level regression.
- **Database:** Prisma migrations have **no automatic down path**. Policy: **forward-fix** (write a new corrective migration). Restoring from a Supabase backup/PITR is the last resort and loses data written after the restore point — a verified backup policy is a production prerequisite.
- **Secrets:** on suspected exposure — rotate in Supabase/provider dashboards, update Vercel env, redeploy, invalidate sessions if auth-related.
- **Providers:** disable by removing provider env vars (adapters honestly degrade to not_configured); set `UPMIND_WEBHOOK_ENABLED=false` to stop webhook acceptance (route returns 200/disabled).
- **Incident checklist:** identify blast radius → roll back app → rotate exposed secrets → disable affected provider/webhook → verify /api/health + auth flow → write an audit note → schedule forward fix → notify affected clients honestly.
