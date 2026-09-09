#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="takatak-linux-artifact:local"

docker build -f "$ROOT/deploy/linux/Dockerfile" -t "$IMAGE" "$ROOT"
container="$(docker create "$IMAGE")"
mkdir -p "$ROOT/var/artifacts"
docker cp "$container:/src/var/artifacts/." "$ROOT/var/artifacts/"
docker rm "$container" >/dev/null
echo "Linux artifacts copied to $ROOT/var/artifacts"
