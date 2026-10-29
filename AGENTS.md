## 🧭 Agent board: read FIRST (owner's order 2026-10-28)

All agents, wherever they run (Claude Code desktop or cloud, claude.ai, Cursor, subagents), coordinate on **one pinned public issue**: https://github.com/takatakca/foodhubca/issues/105
1. **Before any job,** read its latest comments. A job claimed or updated there in the last 24 h belongs to that agent: continue from its next step, or pick another job.
2. **Post** `CLAIM`, then `UPDATE` about every 20 minutes and before long steps, then `PAUSED` or `DONE` when you stop. If a usage limit is near, post `PAUSED` with the exact next step **before** a long step.
3. **One line per comment:** `STATUS | agent: <name> @ <where it runs> | repo · branch → PR | job | next step`.
4. **The board is public:** no secrets, codes, signatures, personal or tax data. Notes in `WORKLOG.md` / `HANDOFF.md` / `private/` still apply. The board is what agents in *other* environments can see.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Work log rule (every agent: Claude, Codex, Cursor, people)

Cheap to follow: read only what is listed here.

1. **Before you start:** read the top of the log (`head -40 WORKLOG.md`) and the titles of open pull requests (`gh pr list`). If a line for the same work is `active` or has an open PR, do not redo it: continue that branch or pick other work.
2. **Claim it:** add one line at the top of the log with status `active`.
3. **Before you stop:** update your line with the status (`done`, `PR #n`, `blocked: reason`) and the next step. Commit and push it with your work. Never stop with unlogged work.
4. One line per piece of work, newest first. Details go in the PR, not the log.

Line format: `YYYY-MM-DD | agent | branch → PR | status | what | next step`

## Brand rule

Everything visual or written for TAKATAK follows `BRAND.md` (logo, colours, tagline, services). Electric blue on deep navy; never the old gold "TK" logo; green is for status only.

## Cursor Cloud specific instructions

- Install with npm and `package-lock.json`: `npm ci --ignore-scripts=false`, then `npm run db:generate`. `.npmrc` sets `ignore-scripts=true` for MochaHost, so a plain `npm ci` skips Prisma's generate step and leaves `@prisma/client` unusable. Do not install from `pnpm-lock.yaml`.
- Start the app with `npm run dev -- --hostname 0.0.0.0 --port 3000`. No secrets are required for local development. Without Supabase env vars, a non-production runtime stays in foundation mode: `/login` shows "Auth not configured yet", `/dashboard` renders mock data, and `GET /api/health` reports `database` and `supabase` as `not_configured`.
- Leave `NODE_ENV` unset for this demo. A production runtime without auth is blocked on purpose.
- Checks that do not need a database: `npm run typecheck`, `npm run lint`, `npm run qa:access`, `npm run test:auth`, and `npm run build` (`next build --webpack`).

## MIMT / TAKATAK AUTH — mandatory product context

For any TAKATAK phone login, Twilio SMS, customer identity/CRM, MIMT telecom, wholesale Internet, SIM/eSIM, or MIMT.ca website task: **read [`docs/mimt/README.md`](docs/mimt/README.md) and the relevant linked runbook first**. Current P0 is [TAKATAK AUTH issue #141](https://github.com/takatakca/takatak-v1/issues/141). Do not create duplicate projects, assume supplier API access, or import private subscribers/communications into agency knowledge. Document actual tests and hand off through WORKLOG.md.
