# Promote an existing verified TAKATAK CI artifact

The manual **Promote verified TAKATAK production artifact** workflow reuses the complete Linux artifact from a successful main push CI run. It does not build on MochaHost, run migrations, create credentials, change DNS, or activate providers. The default `validate` mode does not connect to production.

## Review and one-time operator prerequisites

- Read `AGENTS.md`, the installed Next.js self-hosting guide, and `TAKATAK_MOCHAHOST_DEPLOYMENT.md`.
- Confirm the existing cPanel application uses Node 22, startup file `server.js`, and Application Root `<wrapper>/current`.
- The existing wrapper must have a server-managed `.env`, a `releases/` directory, and `current` symlink to an existing `releases/<previous>/app` rollback release. A legacy direct app directory is refused; the workflow does not convert it or change cPanel settings automatically.
- The server preflight pins `NEXT_PUBLIC_APP_URL=https://takatak.ca` and the production Supabase ref `pcjfahhlozsseqqevimi`. Its required auth/database variables must already be present. Values remain on the server.
- Protect the GitHub `production` environment and restrict it to reviewed main releases. Retain its approval policy.

Configure these **names** in the existing repository production environment only after the intended app/account is established:

| Name | Meaning |
| --- | --- |
| `TAKATAK_PRODUCTION_HOST` | Existing approved SSH host |
| `TAKATAK_PRODUCTION_SSH_PORT` | Existing SSH port |
| `TAKATAK_PRODUCTION_USER` | Existing deployment user |
| `TAKATAK_PRODUCTION_APP_ROOT` | Absolute wrapper root, not the resolved `current/app` path |
| `TAKATAK_PRODUCTION_SSH_PRIVATE_KEY` | Authorized deployment key, never in source |
| `TAKATAK_PRODUCTION_KNOWN_HOSTS` | Out-of-band verified host-key pins |
| `TAKATAK_PRODUCTION_RESTART_COMMAND` | Approved one-line Passenger restart command, also used for rollback |

No value is supplied by this PR. AHMV's secrets in a different repository are not automatically available here. Keep the existing `.env` and provider flags unchanged. The workflow checks presence/format only and does not display values or restart-command output.

## Validate first, then explicitly promote

1. Select the exact current main SHA and its successful **CI** main push run ID. CI must have produced `takatak-ci-<sha>` with a digest and unexpired artifact.
2. Run the workflow on main with `confirm_production_origin=https://takatak.ca` and `mode=validate`. Artifact checksum, safe paths/links, Linux x64/Node 22 profile, webpack/Prisma profile, audit and BUILD_ID must pass. This mode never connects to the host.
3. Only when the operator prerequisites are established, run that same exact current SHA/run with `mode=promote` and the production environment's approval policy.
4. Main must still match before upload and before activation. The workflow uploads to a new immutable release, copies the existing `.env` byte-for-byte, runs names-only/compiled-module preflight, captures the previous release, activates `current`, and executes the approved restart once.
5. `/api/health` must report the SHA in `X-TAKATAK-Release`, captured once by `server.js` at process startup. A new symlink/disk marker cannot make a stale Passenger process claim the new release. `/api/health/ready` must explicitly report database/Supabase `ok`.
6. GET `/api/integrations/ahmv/content/overlays` must exist and return JSON enforcing tenant/auth boundaries. Unconfigured content credentials may return 503; the source promotion does not enable that service. If the shared token is already configured, the server runs the existing authenticated GET-only smoke without exporting its token.

An old artifact without the release-marker helper cannot be promoted by this workflow. After merging this PR, use the new exact main CI artifact; stale pre-merge SHAs are refused.

## Rollback and remaining activation

Errors and handled INT/TERM/HUP signals after activation attempt to restore the captured previous release and rerun the same approved restart. Rollback SSH calls are bounded; public readiness must pass. A runner hard kill or lost transport can still interrupt this best-effort recovery and requires operator attention. Previous releases are retained, and the workflow never prunes them or changes the database.

Initial rollback to a legacy release that lacks the new header proves readiness after restart but cannot attest its historical SHA through HTTP. This limitation is reported; it is not a new-release acceptance shortcut.

After backend release acceptance, separately configure/accept AHMV moderation, Family/auth and social integrations. Their flags and credentials are not changed by this workflow. VPS/Coolify migration remains a different task.

## Validation

`npm run qa:production-release` exercises stale/failed/PR/cross-repository evidence, expired artifacts, checksum/metadata substitution, unsafe transport paths, startup marker behavior, GET-only stale-runtime/HTML/provider boundaries, safe/chained archive links, Bash syntax, and fully mocked failed/interrupted promotion rollbacks. No test connects to production.
