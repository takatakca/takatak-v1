# TAKATAK V1 — Production Cut-over (ordered; do not mark incomplete items done)

1. ☐ Create real Supabase production project
2. ☐ Add Vercel production env vars (auth + DB only; safety flags stay false/unset)
3. ☐ Run `npm run db:deploy` against production DB
4. ☐ Apply RLS 001–007 in order via SQL editor
5. ☐ Create the real owner Profile + ClientMembership (first sign-in flow or manual SQL, documented)
6. ☐ Verify auth: sign-in/out, callback redirect, session persistence
7. ☐ Verify admin access: owner/admin load /dashboard/admin; other roles redirected
8. ☐ **Verify tenant isolation with two real users in different clients** (requires Phase 15 work — currently a blocker)
9. ☐ Confirm foundation mode denied: unauthenticated /dashboard → login, never demo data
10. ☐ Confirm seed guard: `ALLOW_FOUNDATION_SEED` unset; a dry seed run prints the SKIPPED message
11. ☐ Deploy staging first and soak
12. ☐ Run full QA (`npm run qa`, route sweep, honesty scan) against staging
13. ☐ Configure the custom TAKATAK domain + HTTPS (then platform HSTS)
14. ☐ Configure providers ONE at a time: official docs → env vars → real credentialed test → only then rely on "connected"
15. ☐ Production approval sign-off recorded
