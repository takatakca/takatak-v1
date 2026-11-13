# TAKATAK V1 — MochaHost cPanel Git deployment handoff

Codex (ChatGPT), 2026-10-30. Status: prepared, **not production-enabled**.

## Actual server state confirmed by owner

- cPanel Git repository: `/home/bolonca/repositories/takatak-v1`, checked out on `main`.
- Node.js Selector: Node 22, Passenger startup `server.js`.
- Current Node.js app directory: `/home/bolonca/apps/takatak` (legacy direct directory, not an atomic release symlink).
- Application env exists in cPanel for some values. Never copy .env or log secrets.
- cPanel initially disabled Deploy HEAD Commit because `.cpanel.yml` was missing.
- Existing project code explicitly prohibits running Prisma generate on MochaHost; CloudLinux process limits have caused failures. `.npmrc` disables install scripts. Hence **do not build from git on this host**.

## Correct release model

1. Merge this branch after review and CI; in cPanel select **Update from Remote**.
2. Confirm `main` SHA. `.cpanel.yml` enables cPanel's deployment mechanism; it is **fail-closed** until steps 3–5 are completed.
3. Produce the already-supported Node 22 / Linux immutable artifact through the existing GitHub CI. Verify SHA, package, checksum, startup smoke, schema review. Place `takatak-<SHA>.tar.gz` and matching SHA256 file under `/home/bolonca/takatak-releases/incoming/` (outside the web root). No secret files.
4. Establish and test a release directory + `current` symlink, with Passenger's root/entry and persistent environment correctly configured. First cutover from the legacy direct directory must be performed as a controlled operation, not automatically. Retain a rollback source, with explicit owner authorization.
5. Implement/test atomic release selection + Passenger restart, readiness checks and rollback. Only then remove the fail-closed activation gate from `scripts/mochahost-cpanel-deploy.sh`, in a separate reviewed PR.
6. At that point cPanel **Update from Remote → Deploy HEAD Commit** will trigger a verified release. Until then, the button validates a staged artifact but intentionally refuses activation.

**Never:** `npm install`, `npm run build`, `prisma generate`, `prisma migrate deploy`, `rsync --delete`, secret replacement, DNS changes or concurrent production consumers from this cPanel task.

Existing `docs/TAKATAK_PRODUCTION_PROMOTION.md` describes another release workflow requiring an immutable symlink wrapper and GitHub production SSH secrets. Do not pretend its prerequisites already exist on the legacy direct app root.

## Operator tasks

- Review/merge this PR according to the repository coordinator rule.
- In cPanel, click `Update from Remote` after merge to fetch `.cpanel.yml`.
- Do **not** click `Deploy HEAD Commit` until the verified artifact transfer and atomic-release cutover are completed.
- Supply SSH-based deployment access by configuring *GitHub repository secrets*, not posting credentials in chat, if adopting automated artifact upload.
- Keep current production environment values in cPanel. Review pending Prisma migrations separately before enabling the new version.
