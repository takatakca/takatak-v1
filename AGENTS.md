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
