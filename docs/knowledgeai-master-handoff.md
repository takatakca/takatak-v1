# KnowledgeAI → TAKATAK master bridge (review only)

Branch: `feat/knowledgeai-private-auth-20261016`. No direct production change.

## Security boundary

The master database remains the sole source of users, active memberships and
KnowledgeAI product rights. The migration creates `knowledgeai_workspace_grants`
with default-deny booleans for read/write/delete/export, scoped to client +
profile. It seeds NO product, permission, user or default grant.

`src/lib/integrations/knowledgeai/issuer.ts` requires:
1. a real `client_scoped` session from `getServerAccessContext`;
2. an active client, profile and membership, verified from the master DB;
3. an explicitly active `ProductCatalog` row with `code=knowledgeai`;
4. an enabled unexpired per-profile/per-client grant for the requested scope;
5. a dedicated 2048+-bit RSA signing key, HTTPS issuer, audience and private
   backend origin, configured outside GitHub.

The `POST /api/integrations/knowledgeai/search` route enforces same-origin
CSRF protection and a streamed 2 KiB input bound. It issues a read-only 60-second
JWT **inside the TAKATAK server** and forwards the search to the private
KnowledgeAI backend; the browser NEVER receives a raw JWT or other company data.
The GET `/api/integrations/knowledgeai/jwks` route publishes only RSA public key
parameters when explicitly enabled. Both return 503 if unconfigured.

## Activation prerequisites (NOT completed)

- Coordinator review/merge of this PR, successful typecheck, quality CI,
  migration reconciliation and application build.
- Approved migration of the master PostgreSQL, and explicit owner-controlled
  product activation and scoped grants; never infer grants from generic roles.
- Server-side secrets `TAKATAK_KNOWLEDGEAI_ENABLED=1`,
  `TAKATAK_KNOWLEDGEAI_SIGNING_KEY_PEM`, `TAKATAK_KNOWLEDGEAI_KID`,
  `TAKATAK_KNOWLEDGEAI_ISSUER`, `TAKATAK_KNOWLEDGEAI_AUDIENCE`,
  `TAKATAK_KNOWLEDGEAI_PRIVATE_ORIGIN` (secrets never committed).
- An independent confidential KnowledgeAI PostgreSQL and service deployed
  behind protected HTTPS with migration set 001–006, RLS, entitlement sync,
  backup/restore and two-tenant tests. Public KnowledgeAI Vercel is NOT
  a destination for confidential records.

`npm run qa:knowledgeai-issuer` checks the pure crypto and access contract
using ephemeral RSA keys and synthetic identities; it does not prove
a live entitlement, endpoint, or production deployment.
