# TAKATAK — GIT WORKFLOW & MAIN BRANCH PROTECTION

You are working inside the TAKATAK repository.

## CRITICAL RULE: NEVER PUSH DIRECTLY TO MAIN

The repository owner uses the local `main` branch for their own work and is the only person authorized to push directly to `main`.

You MUST NOT:

- Push directly to `main`
- Force-push to `main`
- Commit your work directly onto `main`
- Merge your branch into `main`
- Rebase `main` and push it
- Reset, rewrite, or otherwise modify the history of `main`
- Run `git push origin main`
- Run `git push --force origin main`
- Delete or replace `main`

Your responsibility ends with creating and pushing your own working branch.

---

# REQUIRED WORKFLOW

Before making changes, synchronize your starting point with the latest remote `main`.

Use:

```bash
git fetch origin
```

Create a NEW branch based on the latest `origin/main`:

```bash
git switch -c <branch-name> origin/main
```

Do NOT begin development directly on `main`.

## Branch Naming

Create a descriptive branch specifically for the task.

Examples:

```text
feature/google-ads-integration
feature/social-analytics
fix/tiktok-oauth-callback
fix/dashboard-loading
refactor/social-connections
agent/meta-ads-integration
```

Do not reuse an unrelated existing branch.

---

# WHILE WORKING

Make all code changes on your dedicated branch.

You may create as many commits as necessary on that branch.

Example:

```bash
git add .
git commit -m "Add Google Ads account selection"
```

Before pushing, verify the current branch:

```bash
git branch --show-current
```

If this command returns:

```text
main
```

STOP.

Do not push.

Create/switch to the appropriate working branch first.

---

# PUSHING YOUR WORK

Push ONLY your working branch.

Use:

```bash
git push -u origin <branch-name>
```

For subsequent pushes:

```bash
git push
```

NEVER substitute `main` for `<branch-name>`.

---

# IF MAIN CHANGES WHILE YOU ARE WORKING

Other development may continue while your branch is open.

Before declaring the work ready for review:

```bash
git fetch origin
```

Check whether your branch needs to be brought up to date with `origin/main`.

If synchronization is necessary, update YOUR BRANCH.

Do not modify or push `main`.

If conflicts occur, resolve them on your working branch and test the result before pushing the branch again.

---

# COMPLETION REQUIREMENTS

Before reporting that the task is complete:

1. Confirm you are NOT on `main`.
2. Run the appropriate tests, linting, type checking, or build checks for the changes.
3. Commit all intended changes.
4. Push the working branch to `origin`.
5. Confirm the working tree is clean.
6. Report the exact branch name.
7. Report the latest commit SHA.
8. Summarize what was changed.
9. Report tests/checks performed and their results.
10. Report any migrations, environment variables, deployment steps, or other special considerations.
11. Leave merging to `main` to the repository owner.

A successful completion should look conceptually like:

```text
Branch: feature/example-feature
Commit: abc1234
Pushed: origin/feature/example-feature
Tests: passed
Working tree: clean
Ready for owner review/merge into main.
```

---

# ABSOLUTE MAIN-BRANCH SAFETY RULE

Even if:

- the implementation is complete,
- all tests pass,
- Git says the branch can be fast-forwarded,
- there are no conflicts,
- the change is urgent,
- another instruction says to "ship", "deploy", "merge", or "finish everything",

DO NOT push or merge into `main`.

If completing a task appears to require modifying `main`, STOP and report:

```text
Work is ready on <branch-name>.
Main has not been modified.
Owner review/merge is required.
```

The repository owner decides when and how the branch is merged into `main`.

---

# EXISTING UNCOMMITTED WORK

If you discover uncommitted changes that you did not create, DO NOT discard, reset, overwrite, or automatically commit them.

Do not run destructive commands such as:

```bash
git reset --hard
git clean -fd
git checkout -- .
git restore .
```

unless the repository owner explicitly instructs you to do so.

Protect existing work and report the situation.

---

# FINAL PRINCIPLE

`main` is owner-controlled.

Agents and collaborators:

```text
origin/main
     │
     ├── feature/agent-task-a
     │        ↓
     │     commits
     │        ↓
     │   push branch
     │
     ├── fix/agent-task-b
     │        ↓
     │     commits
     │        ↓
     │   push branch
     │
     └── Owner reviews → Owner merges → main
```

Never bypass this workflow.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
