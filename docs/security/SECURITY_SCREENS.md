# Security screens on takatak.ca (2026-11-04)

Owner's order (GO, 2026-11-04): the pop-ups « pour l'appel, pour les mots de passe et pour l'écran » from
`docs/CLIENT-WEBSITE-SECURITY-STANDARDS.md` (TWILO, Irqc's 7 screenshots: Uber Eats, Scotia, Neo, Google).
What runs, where, and what is left. **The code sign-in itself is not changed.**

## What the person sees

| Screen | When | What it asks | Model |
|---|---|---|---|
| « Êtes-vous en contact avec le soutien TAKATAK ? » | A TAKATAK agent on a call clicks **Vérifier l'identité** in Admin › Users | Tap the number the agent reads out (3 choices), or « Non, je ne parle pas au soutien » | Neo (measure 5) + Google match the number (measure 4) |
| « Nouvelle connexion à votre compte » | A browser the account never used signs in; shown on the person's **other** devices | « C'était vous ? » tap the number shown on the new device, or « Ce n'était pas moi » | Google (measure 4) |
| « Confirmez cette connexion » + number | On the new device itself | Shows the number to tap on the other device; the person can keep working | Google (measure 4) |
| « Connexion approuvée » | On the new device, once the other device tapped the right number | « Vous pouvez retourner à votre autre appareil, ou continuer ici » | Scotia (measure 3) |
| Email « Nouvelle connexion à votre compte TAKATAK » | Same moment as the sign-in question | Date and time (Montréal), account, device (+ partial network); **no link** | Uber Eats (measure 2 pattern) |

Captures: `docs/proofs/2026-11-04/security/` (local preview with the real components; the server answers were
simulated in the browser because the cloud session has no Supabase sign-in).

## Rules (server side, `src/lib/security/checks/`)

- The number to tap is **never sent to the device that must tap it**. One tap only (like Google): a wrong number
  closes the check as « mauvais nombre », so a blind tap passes one time in three, never two in three. The agent
  can start a new check if the person simply mistapped.
- Support check: only a platform owner/admin can start it, never on their own account or a disabled one; at most
  3 open per person; expires after 3 minutes; only the agent who asked follows the answer.
- New sign-in: a device is an opaque random id in an httpOnly cookie (`tk_device`), not a fingerprint. The first
  device of an account is not a « new sign-in ». A device can never approve itself. Expires after 24 hours.
- « Ce n'était pas moi » (or a wrong number on a sign-in): the other sessions are revoked with Supabase
  `signOut({ scope: "others" })` from the trusted device, and the unknown device is forgotten. Tokens already
  issued stay valid until they expire (Supabase default: 1 hour); the screen says so.
- Every request, answer, new device and session closing is in the audit log (`entityType: security_check`).
- Tables `security_checks` and `security_devices`: migration `20261104080000_security_checks`, RLS on, no access
  for the Supabase `anon` / `authenticated` roles.

Tests: `npm run qa:security-checks-db` (12 checks on a real Postgres; CI step on the ephemeral database).

## What the owner must do

- Merge, then deploy (the migration runs with `prisma migrate deploy`).
- The sign-in email uses the sender already used for sign-in codes (SendGrid or Gmail SMTP). Without it, only the
  pop-ups run.

## Not done yet (each needs its own decision)

1. **2-step verification for admin/owner accounts** (measure 1: authenticator app + backup codes). Supabase supports
   it (MFA TOTP), but it changes how admins sign in and needs the MFA setting on the Supabase project. Own PR.
2. **Blocking mode**: today a new device can work while the question waits (like Google's alert). A stricter mode
   (no access until approved) can be turned on later for admin accounts only.
3. **Bank details** (measure 2 itself): TAKATAK never stores bank details; each client's payouts live in its own
   Stripe Connect account, and Stripe sends its own alerts. A TAKATAK alert would need the Stripe
   `account.external_account.*` events on the client invoicing webhook.
4. **Client websites** of the group: the same screens on each client site, with its own settings (inventory first,
   as in TWILO's checklist).

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-11-04 08:17 UTC
