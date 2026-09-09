# TAKATAK production deployment (MochaHost / cPanel / Passenger)

This is the repeatable path for TAKATAK on MochaHost Application Hosting. It replaces uploading a Mac `.next` folder and creating hashed Prisma symbolic links.

## Local development

- Node.js 22 (`nvm use` if `.nvmrc` is present).
- Install with `npm ci`.
- Generate Prisma with `npm run db:generate`.
- Run `npm run dev`.
- Never commit `.env` files.

## Reproducible installation

Production and CI use `npm ci` against `package-lock.json`.

Do not run `npm audit fix --force` automatically, locally, or on the server. It can install breaking major versions.

MochaHost must not run `prisma generate`. CloudLinux nproc already belongs to Passenger/lsnode.

## Prisma

Canonical schema: `prisma/schema.prisma`.

`prisma/generated/schema.prisma` is not an editable source and is not an import path.

Production generator:

```
generator client {
  provider   = "prisma-client-js"
  engineType = "client"
}
```

Application code imports `@prisma/client` and connects with `@prisma/adapter-pg`. The JavaScript client engine is required because MochaHost cannot run Prisma's Rust query engine.

Generate during the Linux build. Include the generated client in the artifact through `node_modules`. Do not generate on the live Passenger host.

`DATABASE_URL` is the pooled application URL. `DIRECT_URL` is for direct/admin operations such as migrations. This deployment task does not run migrations.

## Why `.next` alone must never be uploaded

A Next.js compile is not the application. Runtime still needs:

- `server.js` (Passenger entry)
- `node_modules` built on Linux for Node 22
- generated Prisma client
- `public`
- `package.json` / `package-lock.json`
- canonical Prisma schema

A Mac `.next` directory also does not match Linux Prisma/native optional dependencies.

## Why hashed Prisma aliases are not a solution

Next.js 16 default `next build` uses Turbopack. Turbopack rewrites server externals to names such as `@prisma/client-<hash>`. Those names are not npm packages. Emergency symlinks in `node_modules` can make a route load once, then break on the next install or upload.

Production builds use `next build --webpack`. The compiled output must `require("@prisma/client")` and `require("@prisma/adapter-pg")`. `npm run check:modules` fails the release if hashed aliases appear.

## Production build

On Linux, Node 22.23.x:

```
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm run test:auth
npm run build
npm run check:modules
node scripts/pack-production-artifact.cjs
```

Or:

```
bash deploy/linux/build-artifact.sh
```

## Artifact

The tarball contains a complete `app/` directory: compiled Next.js, `public`, Linux `node_modules`, `server.js`, lockfile, schema, migrations, health/preflight scripts, and `BUILD_ID`. It must not contain `.env` or other secrets.

## Staging first

Keep `https://takatak.ca` on the current release until staging passes.

Suggested layout, adapted to the cPanel app root:

```
/home/<user>/apps/takatak-staging/
  releases/<build-id>/
  current -> releases/<build-id>
  previous -> releases/<previous-build-id>
  .env
```

cPanel Node.js usually points Application Root at one directory and startup file at `server.js`. If the panel cannot follow a `current` symlink as Application Root, extract the new release into a sibling folder, validate, then change the Application Root once.

### Staging procedure

1. Upload/extract the artifact into `releases/<build-id>/`.
2. Copy `.env` into that release. Do not pack secrets in the tarball.
3. Do not run `npm install` on the server if the artifact already includes Linux `node_modules`.
4. Run `npx tsx scripts/production-preflight.ts` in the release (or `node` equivalent after build tooling is present).
5. Run `npx tsx scripts/check-module-load.ts .`
6. Point the staging application at the new release.
7. Restart Passenger once from cPanel: **Stop App**, wait, **Start App**. Do not click Restart in a loop. Do not edit env vars repeatedly to bounce the process.
8. Run the staging checklist below.
9. Keep the previous release on disk. Do not delete it during the same deployment.

### Staging checklist

- Home page loads.
- Login page loads.
- Existing staging account lookup sends email OTP through Gmail App Password SMTP.
- OTP page accepts the code.
- Session cookies are set (`Secure`, `HttpOnly`, `SameSite=Lax`, `path=/`).
- Redirect to `/dashboard` works and an authenticated request succeeds.
- Logout clears auth and workspace cookies.
- Registration, if enabled.
- Resend-code cooldown.
- Invalid OTP and expired OTP return JSON messages.
- Disabled account cannot sign in.
- `POST /api/auth/login` with `{}` returns JSON 4xx.
- `POST /api/auth/verify-otp` with `{}` returns JSON 4xx.
- `POST /api/auth/verify-otp` with diagnostic email `otp-diagnostic-do-not-use@takatak.ca` returns JSON 4xx.
- Stripe webhook route loads.
- Social OAuth callback routes load.
- `/api/health` and `/api/health/ready` return JSON.
- Passenger starts once and process count stays stable.

Never use a real customer account for automated tests.

## Production promotion

Promote only after staging passes.

1. Extract the same artifact into a new production release directory.
2. Validate preflight and module-load against that directory.
3. Switch Application Root / `current` symlink.
4. Restart Passenger once.
5. Re-run public health and the JSON auth smoke tests.
6. Leave the previous production release in place.

Do not remove the emergency hashed Prisma symlinks from the old production directory until the new release is confirmed. The new release must not need them.

## Passenger restart

In cPanel Node.js:

1. Stop the application.
2. Confirm the process has exited.
3. Start the application once.

The startup file is `server.js`. It listens on Passenger's socket when `PhusionPassenger` is present, otherwise on `PORT`.

Logs: cPanel Node.js stderr / Passenger logs for the application. The process writes `[server]` lines without secret values. Auth failures log `errorId` and a stage name.

## Environment variables

Manage `.env` only on the server, outside the artifact. Required names (values never logged):

- `DATABASE_URL` (pooled)
- `DIRECT_URL` (direct / migrations)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `EMAIL_USER` and `EMAIL_PASSWORD` (or SendGrid)

Optional / feature-specific: Twilio, Stripe, Upmind. A missing optional integration must not crash login.

`PGSSL_REJECT_UNAUTHORIZED=false` is used on MochaHost because the platform TLS chain is not in the default trust store. That is a host constraint, not an invitation to disable TLS on localhost.

## Rollback

1. Point Application Root / `current` back to `previous`.
2. Restart Passenger once.
3. Hit `/api/health`.
4. Do not touch the database.
5. Leave diagnostic logs in place.

No rebuild is required if the previous complete release is still on disk.

## Safe dependency updates

Pin Prisma trio together: `@prisma/client`, `@prisma/adapter-pg`, `prisma`. Update all three to the same version, regenerate the lockfile, run `npm run qa:auth` and a Linux artifact build. Do not upgrade merely because a newer version exists.
