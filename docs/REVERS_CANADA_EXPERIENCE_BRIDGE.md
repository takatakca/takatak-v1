# REVERS CANADA — TAKATAK Experience Bridge

## Purpose

REVERS CANADA is an independent product experience. TAKATAK remains the master identity and authorization authority.

This bridge follows the existing AHMV ExperienceLaunchCode pattern:

1. A person signs in to TAKATAK.
2. TAKATAK verifies the master identity.
3. TAKATAK confirms the REVERS product entitlement.
4. TAKATAK creates a one-time, short-lived launch code.
5. The browser is redirected to the configured REVERS callback.
6. REVERS sends the code server-to-server to the TAKATAK exchange endpoint using the dedicated REVERS service token.
7. TAKATAK consumes the code exactly once and re-checks REVERS access.
8. REVERS creates a short-lived product session. This session is derived from TAKATAK identity; REVERS does not become a master identity authority.

## Endpoints

### Launch

GET /api/experiences/revers/launch

Authentication: the normal TAKATAK Auth session.

Behavior:
- unauthenticated → TAKATAK login with a next target;
- authenticated → ensure the TAKATAK profile/master identity is synchronized;
- missing REVERS entitlement → 403;
- missing callback configuration → 503;
- success → 303 redirect to REVERS_EXPERIENCE_CALLBACK_URL?code=....

### Exchange

POST /api/experiences/revers/exchange

Authentication: dedicated server-to-server bearer token TAKATAK_REVERS_SERVICE_TOKEN.

Body: {"code":"<one-time-code>"}

The code is:
- generated with cryptographic randomness;
- persisted only as a SHA-256 hash;
- valid for 90 seconds;
- one-time use;
- revalidated against the current REVERS membership and entitlement after consumption.

The response contains only the minimum product-session context:
- TAKATAK master identity id;
- display name;
- product code;
- entitlement code;
- plan code;
- session expiry.

Email, phone, private notes and business records are not returned by this exchange.

## Product access

Product code: revers
Entitlement: revers_access
Default free plan: revers_community

The first explicit launch by an authenticated TAKATAK identity may create the REVERS membership if none exists. An existing suspended, canceled or expired membership is never silently reactivated.

## Security

- Dedicated REVERS service token; never reuse an AHMV token.
- Token is server-side only.
- Launch code is one-time and hashed at rest.
- Exchange responses are no-store.
- REVERS product sessions are short-lived.
- Production callback must use HTTPS.
- Do not log launch codes, service tokens or session secrets.
- Do not place master identity credentials in the REVERS browser bundle.

## Production configuration

TAKATAK:
- TAKATAK_REVERS_SERVICE_TOKEN
- REVERS_EXPERIENCE_CALLBACK_URL

REVERS:
- TAKATAK_EXPERIENCE_LAUNCH_URL
- TAKATAK_API_BASE_URL
- TAKATAK_REVERS_SERVICE_TOKEN
- REVERS_SESSION_SECRET

The final REVERS production domain is intentionally not hardcoded until the owner confirms it.

## Ownership boundary

TAKATAK owns:
- master identity;
- product entitlement;
- product access decision;
- master permissions;
- launch authorization.

REVERS owns:
- its public website;
- its operational records;
- its contact requests;
- its donation records;
- its product UI and workflows.

REVERS does not read TAKATAK tables directly.
TAKATAK does not become the operator or accountant of REVERS's ordinary business records.

## Status vocabulary

A missing secret/configuration is NOT CONFIGURED, not CONNECTED.
A connection is only considered operational after a real server-side exchange succeeds in the target environment.