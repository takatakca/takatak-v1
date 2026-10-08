<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git: main belongs to the owner (owner's order, 2026-10-08)
Nobody but the owner touches `main`. Not even a docs-only commit.
- **Never:** commit on local `main`; `git push origin main` or `HEAD:main`; merge into `main`; rebase, reset or rewrite `main`; force-push.
- **Work flow:** `git fetch origin`, then `git switch -c <type>/<name> origin/main` (type: `feature`, `fix`, `refactor`, `docs` or `agent`). Push only that branch: `git push -u origin <type>/<name>`.
- **Before "done":** you are not on `main`, the checks ran, the work is committed, the branch is pushed, the working tree is clean.
- **Report:** branch, SHA, what changed, checks and results, env / migration / deploy notes, and "ready for owner review/merge". The owner merges and deploys.
- **Never discard uncommitted work you did not create** (`reset --hard`, `clean -fd`, `checkout -- .`, `restore .`). Report it to the owner instead.
- The owner works in the main checkout, on `main`. Never commit there: use a git worktree (`git worktree add <dir> -b <type>/<name> origin/main`).
- A local `pre-push` hook refuses any push to `main` when the environment variable `CLAUDECODE` is set. It never blocks the owner. Do not work around it.
