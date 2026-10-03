<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Install with npm and `package-lock.json`: `npm ci --ignore-scripts=false`, then `npm run db:generate`. `.npmrc` sets `ignore-scripts=true` for MochaHost, so a plain `npm ci` skips Prisma's generate step and leaves `@prisma/client` unusable. Do not install from `pnpm-lock.yaml`.
- Start the app with `npm run dev -- --hostname 0.0.0.0 --port 3000`. No secrets are required for local development. Without Supabase env vars, a non-production runtime stays in foundation mode: `/login` shows "Auth not configured yet", `/dashboard` renders mock data, and `GET /api/health` reports `database` and `supabase` as `not_configured`.
- Leave `NODE_ENV` unset for this demo. A production runtime without auth is blocked on purpose.
- Checks that do not need a database: `npm run typecheck`, `npm run lint`, `npm run qa:access`, `npm run test:auth`, and `npm run build` (`next build --webpack`).
