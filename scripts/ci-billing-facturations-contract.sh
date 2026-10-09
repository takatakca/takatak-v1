#!/usr/bin/env bash
# GROUPE TAKATAK Billing — live contract test in CI.
# Starts the REAL Facturations service (public repo, pinned exact SHA) on
# loopback with its own disposable database inside the ephemeral CI Postgres,
# then runs scripts/billing-facturations-local-e2e.ts against it.
# Synthetic data only. Never targets a hosted environment.
set -euo pipefail

: "${FACTURATIONS_REF:?FACTURATIONS_REF (exact 40-hex SHA) is required}"
: "${DATABASE_URL:?DATABASE_URL (ephemeral CI database) is required}"

if [[ ! "$FACTURATIONS_REF" =~ ^[0-9a-f]{40}$ ]]; then
  echo "FACTURATIONS_REF must be an exact 40-hex commit SHA." >&2
  exit 1
fi

case "$DATABASE_URL" in
  postgres*://*@127.0.0.1:*|postgres*://*@localhost:*) ;;
  *) echo "Refusing: DATABASE_URL must be loopback." >&2; exit 1 ;;
esac

WORK_DIR="$(mktemp -d)"
FACT_DIR="$WORK_DIR/facturations"
FACT_PORT=4319
FACT_LOG="$WORK_DIR/facturations.log"
FACT_PID=""

cleanup() {
  if [ -n "$FACT_PID" ]; then
    kill "$FACT_PID" 2>/dev/null || true
  fi
  if [ -f "$FACT_LOG" ]; then
    echo "--- Facturations log (tail) ---"
    tail -n 40 "$FACT_LOG" || true
  fi
}
trap cleanup EXIT

git init -q "$FACT_DIR"
git -C "$FACT_DIR" fetch -q --depth=1 https://github.com/takatakca/Facturations "$FACTURATIONS_REF"
git -C "$FACT_DIR" checkout -q FETCH_HEAD
test "$(git -C "$FACT_DIR" rev-parse HEAD)" = "$FACTURATIONS_REF"
(cd "$FACT_DIR" && npm ci --ignore-scripts --no-audit --no-fund)

# Disposable Facturations database next to the ephemeral TAKATAK database.
FACT_DB_URL="$(node -e '
const u = new URL(process.env.DATABASE_URL);
u.pathname = "/facturations_test";
u.search = "";
console.log(u.toString());
')"
node -e '
const { Client } = require("pg");
const admin = new URL(process.env.DATABASE_URL);
admin.search = "";
const c = new Client({ connectionString: admin.toString(), ssl: false });
c.connect()
  .then(() => c.query("DROP DATABASE IF EXISTS facturations_test"))
  .then(() => c.query("CREATE DATABASE facturations_test"))
  .then(() => c.end())
  .catch((e) => { console.error(e.message); process.exit(1); });
'
(cd "$FACT_DIR" && FACTURATIONS_TEST_DATABASE_URL="$FACT_DB_URL" node scripts/setup-test-db.js)

SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')"
ISSUER="takatak-v1-ci"
AUDIENCE="facturations-ci"
BUSINESS_ID="biz-groupe-takatak-ci"

(
  cd "$FACT_DIR"
  NODE_ENV=development \
  PORT="$FACT_PORT" \
  FACTURATIONS_DATABASE_URL="$FACT_DB_URL" \
  WAVE_BUSINESS_ID="$BUSINESS_ID" \
  FACTURATIONS_INTEGRATION_ENABLED=1 \
  FACTURATIONS_INTEGRATION_WRITES_ENABLED=1 \
  FACTURATIONS_INTEGRATION_ISSUER="$ISSUER" \
  FACTURATIONS_INTEGRATION_AUDIENCE="$AUDIENCE" \
  FACTURATIONS_INTEGRATION_HMAC_SECRET="$SECRET" \
  exec node app.js
) > "$FACT_LOG" 2>&1 &
FACT_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$FACT_PORT/health" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:$FACT_PORT/health" > /dev/null

BILLING_E2E_CONFIRM_LOCAL=1 \
NODE_ENV=development \
FACTURATIONS_INTEGRATION_ENABLED=1 \
FACTURATIONS_ORIGIN="http://127.0.0.1:$FACT_PORT" \
FACTURATIONS_INTEGRATION_HMAC_SECRET="$SECRET" \
FACTURATIONS_INTEGRATION_ISSUER="$ISSUER" \
FACTURATIONS_INTEGRATION_AUDIENCE="$AUDIENCE" \
FACTURATIONS_BUSINESS_ID="$BUSINESS_ID" \
npx tsx --require ./scripts/register-server-only.cjs scripts/billing-facturations-local-e2e.ts
