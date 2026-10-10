#!/usr/bin/env bash
# Stop hook: reminds an agent to update WORKLOG.md before it stops.
# Silent (no cost) unless this branch changed files and WORKLOG.md was not updated.
input=$(cat)
case "$input" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;; esac
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
base=$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)
changed=$({ git diff --name-only "$base"...HEAD 2>/dev/null; git status --porcelain 2>/dev/null | cut -c4-; } | sort -u)
[ -z "$changed" ] && exit 0
printf '%s\n' "$changed" | grep -qx 'WORKLOG.md' && exit 0
echo '{"decision":"block","reason":"Before stopping: add or update your one line at the top of WORKLOG.md (date | agent | branch → PR | status | what | next step), then commit and push it with your work. See AGENTS.md › Work log rule."}'
