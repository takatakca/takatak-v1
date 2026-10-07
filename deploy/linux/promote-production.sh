#!/usr/bin/env bash
# Manual artifact promotion only. No build, npm install, migration, seed or provider activation.
set -Eeuo pipefail

[[ "${PROMOTION_MODE:-}" == "promote" ]] || { echo "Promotion was not explicitly selected." >&2; exit 1; }
[[ "${PRODUCTION_ORIGIN:-}" == "https://takatak.ca" ]] || { echo "Unexpected production origin." >&2; exit 1; }
[[ "${RELEASE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid release SHA." >&2; exit 1; }
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ ]] || { echo "Invalid workflow run ID." >&2; exit 1; }
[[ "${TKT_APP_ROOT:-}" =~ ^/[a-zA-Z0-9._/-]+$ ]] || { echo "Invalid app wrapper path." >&2; exit 1; }
[[ "$TKT_APP_ROOT" != */ && "$TKT_APP_ROOT" != *//* && "$TKT_APP_ROOT" != */../* && "$TKT_APP_ROOT" != */.. && "$TKT_APP_ROOT" != */./* ]] || { echo "Unconfined app wrapper path." >&2; exit 1; }
test -n "${TKT_RESTART_COMMAND:-}" || { echo "Approved Passenger restart command is missing." >&2; exit 1; }

ssh_config="$RUNNER_TEMP/takatak-ssh/config"
test -f "$ssh_config"
release_key="$RELEASE_SHA-$GITHUB_RUN_ID"
release_dir="$TKT_APP_ROOT/releases/$release_key"
archive="takatak-ci-$RELEASE_SHA.tar.gz"
active=0
previous=""
rolling_back=0

remote() {
  if [[ "$rolling_back" == 1 ]]; then
    timeout --kill-after=3s 10s ssh -F "$ssh_config" takatak-production "$@"
  else
    timeout --kill-after=5s 120s ssh -F "$ssh_config" takatak-production "$@"
  fi
}
restart() {
  local restart_quoted
  printf -v restart_quoted '%q' "$TKT_RESTART_COMMAND"
  remote "bash -s -- '$TKT_APP_ROOT' $restart_quoted" <<'REMOTE'
set -euo pipefail
cd "$1/current"
# Do not expose the approved command or any cPanel command response in CI logs.
bash -lc "$2" >/dev/null 2>&1 || { echo "Approved Passenger restart failed." >&2; exit 1; }
REMOTE
}

rollback() {
  local result=$?
  # One EXIT handler covers errors and handled signals, without re-entering rollback.
  trap - EXIT INT TERM HUP
  rolling_back=1
  if [[ "$result" != 0 && "$active" == 1 && -n "$previous" ]]; then
    echo "Promotion failed after activation; restoring captured previous release." >&2
    if remote "bash -s -- '$TKT_APP_ROOT' '$previous'" <<'REMOTE'
set -euo pipefail
root="$1"
previous="$2"
case "$previous" in "$root"/releases/*/app) ;; *) exit 1 ;; esac
test -f "$previous/server.js"
ln -s "$previous" "$root/current.rollback"
mv -Tf "$root/current.rollback" "$root/current"
REMOTE
    then
      if restart; then
        if curl --fail --silent --show-error --max-time 15 "$PRODUCTION_ORIGIN/api/health/ready" > "$RUNNER_TEMP/takatak-rollback-ready.json"; then
          node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(p.ok!==true||p.checks?.database!=="ok"||p.checks?.supabase!=="ok")process.exit(1)' "$RUNNER_TEMP/takatak-rollback-ready.json" && echo "Previous release restored and public readiness passed." || echo "ERROR: rollback readiness requires operator attention." >&2
        else
          echo "ERROR: rollback public readiness requires operator attention." >&2
        fi
      else
        echo "ERROR: rollback restart requires operator attention." >&2
      fi
    else
      echo "ERROR: rollback activation requires operator attention." >&2
    fi
  fi
  exit "$result"
}
trap rollback EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# Read-only server preflight. A direct legacy app directory is not silently converted.
previous="$(remote "bash -s -- '$TKT_APP_ROOT'" <<'REMOTE'
set -euo pipefail
root="$(realpath -e "$1")"
test "$root" = "$1"
test -f "$root/.env"
test -L "$root/current"
current="$(realpath -e "$root/current")"
case "$current" in "$root"/releases/*/app) ;; *) echo "Existing current release is outside the app wrapper." >&2; exit 1 ;; esac
test -f "$current/server.js"
[[ "$(node --version)" == v22.* ]] || { echo "Production Node 22 is required." >&2; exit 1; }
node --env-file="$root/.env" -e '
const app = process.env.NEXT_PUBLIC_APP_URL;
const db = process.env.DATABASE_URL || "";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
if(app!=="https://takatak.ca"||supabase!=="https://pcjfahhlozsseqqevimi.supabase.co"||!db.includes("pcjfahhlozsseqqevimi")) {
  console.error("Production app/database project pin mismatch.");process.exit(1);
}'
printf '%s' "$current"
REMOTE
)"
case "$previous" in "$TKT_APP_ROOT"/releases/*/app) ;; *) echo "No valid rollback target was captured." >&2; exit 1 ;; esac

# Refuse a stale release immediately before any production write.
current_main="$(gh api "repos/$GH_REPO/branches/main" --jq '.commit.sha')"
test "$current_main" = "$RELEASE_SHA" || { echo "Main advanced before upload; promotion refused." >&2; exit 1; }
remote "test ! -e '$release_dir' && mkdir -p '$release_dir'"
scp -F "$ssh_config" "$RUNNER_TEMP/takatak-release/$archive" "$RUNNER_TEMP/takatak-release/$archive.sha256" "takatak-production:$release_dir/"

remote "bash -s -- '$TKT_APP_ROOT' '$release_key' '$RELEASE_SHA' '$archive'" <<'REMOTE'
set -euo pipefail
root="$1"
release="$root/releases/$2"
cd "$release"
sha256sum --check "$4.sha256" >/dev/null
tar -xzf "$4"
test "$(cat app/BUILD_ID)" = "ci-$3"
test -f app/server.js
test -f app/scripts/server-release.cjs
test ! -e app/.env
cp "$root/.env" app/.env
chmod 600 app/.env
cd app
# Existing config is copied byte-for-byte; values and logs remain on the server.
NODE_ENV=production node --env-file=.env --import tsx scripts/production-preflight.ts > ../preflight.log 2>&1 || { echo "Production preflight failed (names-only operator log retained)." >&2; exit 1; }
NODE_ENV=production node --env-file=.env --import tsx scripts/check-module-load.ts . > ../modules.log 2>&1 || { echo "Production compiled-module preflight failed." >&2; exit 1; }
REMOTE

current_main="$(gh api "repos/$GH_REPO/branches/main" --jq '.commit.sha')"
test "$current_main" = "$RELEASE_SHA" || { echo "Main advanced before activation; promotion refused." >&2; exit 1; }
# Mark potential activation before SSH: a lost connection after mv still triggers rollback.
active=1
remote "bash -s -- '$TKT_APP_ROOT' '$release_key'" <<'REMOTE'
set -euo pipefail
root="$1"
target="$root/releases/$2/app"
test -f "$target/server.js"
ln -s "$target" "$root/current.new"
mv -Tf "$root/current.new" "$root/current"
REMOTE
restart

accepted=0
for attempt in {1..12}; do
  if node scripts/production-release-smoke.mjs; then accepted=1; break; fi
  sleep 5
done
test "$accepted" = 1 || { echo "Exact release/public route acceptance failed." >&2; false; }

# If already configured, authenticate the GET-only smoke on the server without moving its token.
remote "bash -s -- '$TKT_APP_ROOT'" <<'REMOTE'
set -euo pipefail
cd "$1/current"
if node --env-file=.env -e 'process.exit((process.env.TAKATAK_AHMV_CONTENT_TOKEN||"").trim().length>=32?0:3)'; then
  SMOKE_BASE_URL=https://takatak.ca node --env-file=.env --import tsx scripts/smoke-ahmv-content.ts > ../content-smoke.log 2>&1 || { echo "Authenticated read-only content smoke failed." >&2; exit 1; }
  echo "Authenticated content GET smoke passed."
else
  echo "TAKATAK_AHMV_CONTENT_TOKEN is not configured; provider activation was not attempted."
fi
REMOTE
active=0
echo "Exact production artifact accepted. Database, DNS and provider configuration were not changed."
