# BEH4VIOR / master dashboard bridge (planned, not built)

BEH4VIOR code: https://github.com/takatakca/BEH4VIOR

BEH4VIOR is a new owner project (order of 2026-11-10): a daily behaviour tracker for young children, shared between home and school. It turns the face sheet a school sends home into five goals for the next day, 20% each. A first prototype and its continuity documents are on BEH4VIOR main. It is not deployed.

**This note adds no code, no route, no migration and no configuration to V1.** It records the intended contract so the next agent does not invent a second login.

TAKATAK-V1 remains the **single master dashboard** for shared authentication, identity, subscriptions, entitlements and billing. BEH4VIOR will be a separately deployed experience, launched the same way as Academy ([TAKATAK_ACADEMY_BRIDGE.md](TAKATAK_ACADEMY_BRIDGE.md)).

## Proposed routes (same shape as Academy)

- `/dashboard/beh4vior`: authenticated dashboard entry, using `TAKATAK_BEH4VIOR_URL`. Truthful "not configured" state when missing.
- `GET /api/experiences/beh4vior/launch?state=<43-character base64url>`: login with `next` preserved, profile sync, active master identity check, 90-second one-time code hashed in `ExperienceLaunchCode`.
- `POST /api/experiences/beh4vior/exchange`: bearer-secret protected, one-time atomic consumption. Returns `{ok:true,session:{masterIdentityId,displayName,productCode:"beh4vior",entitlements:["beh4vior_free"],expiresAt}}`.

Expected configuration names: `TAKATAK_BEH4VIOR_URL`, `BEH4VIOR_EXPERIENCE_CALLBACK_URL`, `TAKATAK_BEH4VIOR_SERVICE_TOKEN`. No V1 migration is expected. Free access only until a real product and price exist.

## Hard boundary: no child data in V1

Children, classes, daily sheets, goals and messages stay in BEH4VIOR's own database, keyed by `masterIdentityId`. V1 must not receive or store a child's name, score or note. V1 knows only that an adult account may open the product.

## Before anyone builds this

1. Owner answers the open questions in BEH4VIOR `docs/TASK_QUEUE.md` (scoring, who fills the faces, first school).
2. Owner closes the consent and privacy gate in the same file (minors' data, Quebec Law 25, school agreement).
3. Decide whether a V1 workspace is the right container for a class shared by parents and a teacher.

Then submit the routes as a normal PR under the WORKLOG release rules. No direct main change, no production deploy.

— signed: Claude (Fable 5.2) @ claude.ai chat · 2026-11-10 23:58 EST
