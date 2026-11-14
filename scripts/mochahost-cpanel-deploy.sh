#!/usr/bin/env bash
# Codex (ChatGPT) — 2026-10-30. cPanel deployment gate.
# Production activation is intentionally blocked until an immutable CI release
# has been staged and the Node.js app is configured for atomic release switching.
set -Eeuo pipefail
umask 077

REPO="/home/bolonca/repositories/takatak-v1"
APP_ROOT="/home/bolonca/apps/takatak"
RELEASE_ROOT="/home/bolonca/takatak-releases"
cd "$REPO"

SHA="$(git rev-parse --verify HEAD)"
BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ "$BRANCH" != "main" || ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "[takatak] REFUSED: deploy requires checked-out main and valid commit SHA." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "[takatak] REFUSED: repository has uncommitted changes." >&2
  exit 1
fi

# Build happens in GitHub Actions (Node 22 / Linux), never on MochaHost.
ARCHIVE="$RELEASE_ROOT/incoming/takatak-$SHA.tar.gz"
CHECKSUM="$ARCHIVE.sha256"
if [[ ! -f "$ARCHIVE" || ! -f "$CHECKSUM" ]]; then
  echo "[takatak] REFUSED: verified CI artifact for $SHA not staged." >&2
  echo "[takatak] Expected: $ARCHIVE and $CHECKSUM" >&2
  exit 1
fi
command -v sha256sum >/dev/null || { echo "[takatak] Missing sha256sum" >&2; exit 1; }
(cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$CHECKSUM")") || {
  echo "[takatak] REFUSED: artifact checksum mismatch." >&2
  exit 1
}
if [[ -L "$ARCHIVE" || -L "$CHECKSUM" ]]; then
  echo "[takatak] REFUSED: artifact input cannot be a symlink." >&2
  exit 1
fi

# A direct legacy Passenger application directory cannot be swapped atomically.
# Require the operator to configure cPanel's Node.js Application Root to the
# release symlink after a successful preview; never overwrite the live tree.
if [[ ! -L "$APP_ROOT" ]]; then
  echo "[takatak] REFUSED: $APP_ROOT is currently a direct directory." >&2
  echo "[takatak] Set up a release symlink and verify cPanel Passenger config first." >&2
  exit 1
fi

STAGE="$RELEASE_ROOT/releases/$SHA"
if [[ ! -d "$STAGE/app" ]]; then
  mkdir -p "$STAGE"
  # Do not extract untrusted archives with absolute or parent traversal paths.
  if tar -tzf "$ARCHIVE" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    echo "[takatak] REFUSED: unsafe archive paths." >&2
    exit 1
  fi
  tar -xzf "$ARCHIVE" -C "$STAGE"
fi
for required in server.js .next/BUILD_ID public package.json node_modules/next node_modules/@prisma/client; do
  if [[ ! -e "$STAGE/app/$required" ]]; then
    echo "[takatak] REFUSED: missing artifact member $required" >&2
    exit 1
  fi
done
if [[ -e "$STAGE/app/.env" || -e "$STAGE/app/.env.local" ]]; then
  echo "[takatak] REFUSED: secrets packaged in release." >&2
  exit 1
fi

# Activation intentionally needs an audited site-specific restart/rollback
# procedure. The initial cPanel button checks artifacts without touching
# production. Do not remove this gate until a controlled cutover is verified.
echo "[takatak] Verified staged artifact $SHA"
echo "[takatak] NOT ACTIVATED: release switching, existing environment storage,"
echo "[takatak] Passenger restart and rollback have not been validated."
exit 1
