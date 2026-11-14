# KnowledgeAI — TAKATAK master issuer (draft integration)

**Status: gated draft PR; not merged, not configured, no private service activated.**

TAKATAK is the only identity and client-membership authority. KnowledgeAI
remains an independent backend and must continue to re-check its own private
workspace entitlements, source approvals, JWT revocations and database RLS.

## Changes

- Prisma model `KnowledgeAiGrant`, one explicit grant per profile+client,
  all permission flags false and enabled false by default.
- Migration adds `knowledgeai_grants`, protected by FORCE RLS and revoked
  PostgREST grants; product catalog row `knowledgeai` starts at status `planned`.
- Read-only product/entitlement authority check requires a validated Supabase
  user session, matching active TAKATAK Profile, active ClientMembership,
  active Client, active KnowledgeAI product and an enabled unexpired grant.
- Four independent permission flags: read, write, delete, export. A corresponding
  effective workspace permission is also required. A generic dashboard role,
  platform owner status or the `ai_studio` service does not enable KnowledgeAI.
- `POST /api/integrations/knowledgeai/token`: restricted to configured
  internal server consumers with a high-entropy secret and user session.
  Returns a 60-second scope-specific RS256 JWT; never logs claims or tokens.
- `GET /api/integrations/knowledgeai/jwks`: public RSA parameters only,
  returns 503 until feature enable and a valid key are configured.

## Required secret names (values must never be committed)

- `KNOWLEDGEAI_ISSUER_ENABLED=1` **only after** a reviewed rollout.
- `KNOWLEDGEAI_ISSUER_ORIGIN` (exact HTTPS origin),
  `KNOWLEDGEAI_AUDIENCE`, `KNOWLEDGEAI_SIGNING_KID`,
  `KNOWLEDGEAI_SIGNING_KEY_PEM` (>=2048-bit RSA PKCS#8).
- `KNOWLEDGEAI_EXCHANGE_SECRET` (32+ random characters) held by
  TAKATAK and its internal caller, not in browser JavaScript.

## Go-live gate

1. Approve the migration after verifying the current TAKATAK migration head.
2. Define the operational reviewer for explicit user/client grants.
3. Require an active `knowledgeai` product catalog record and deliberate
   enabled grant to activate each tested user and scope.
4. Install a dedicated signing key in the server secret manager, publish
   the matching public JWKS, verify with KnowledgeAI's real JWT verifier.
5. Provision an approved confidential PostgreSQL database for KnowledgeAI,
   migrations 001–006, strict TLS and least-privileged RLS SQL account.
6. Run staged two-client tests including denial, revocation, key rotation,
   source approval, backups and private operational monitoring.

Never merge this draft purely because an isolated contract test passes.
Neither TAKATAK homepage nor public KnowledgeAI documents are changed.
