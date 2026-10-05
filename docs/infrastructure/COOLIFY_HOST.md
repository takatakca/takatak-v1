# Coolify on takatak-core-01

Recorded from `takatak@31.220.96.134` with `sudo -n`. No secret values. A second Coolify was not installed.

## Already running

| Piece | Version |
| --- | --- |
| Docker Engine | 29.8.2 |
| Docker Compose | v5.6.0 |
| Coolify | `coollabsio/coolify:4.3.23` |
| Proxy | `traefik:v3.6` |
| Coolify database | `postgres:15-alpine` (container only, port 5432 not on the host) |
| Coolify Redis | `redis:7-alpine` (Coolify's own Redis, port 6379 not on the host) |
| Realtime | `coollabsio/coolify-realtime:1.0.19` |
| Sentinel | `coollabsio/sentinel:1.0.1` |

Data directory: `/data/coolify`. Environment file: `/data/coolify/source/.env` (keys only; values stay on the server).

Containers that were already up and healthy: `coolify`, `coolify-db`, `coolify-redis`, `coolify-realtime`, `coolify-proxy`, `coolify-sentinel`. An existing `nginx:alpine` application container and one unpublished app container on port 3000 were also up. They were not recreated in this step.

`instance_settings` id 0 has public IPv4 `31.220.96.134`, dashboard HTTPS forced on, and FQDN `https://coolify.takatak.ca`.

## Build concurrency

`server_settings` id 1 (`server_id` 0) had `concurrent_builds` 2. It was set to 1 and read back as 1. Two Next.js builds cannot run together on this host.

## Projects already in Coolify

| Project | Environments |
| --- | --- |
| `takatak-server` | `production` |
| `GROUPE TAKATAK` | `production`, `stagging` (name is misspelled) |

Applications already present, Coolify status `exited:unhealthy` at the time of this record: `test server`, two resources named `takatak-staging`, and `takatak-v1` with FQDN `https://takatak.ca`. Production workers were not started. Customer DNS was not changed. The `https://takatak.ca` row was not deleted and was not pointed at this server from public DNS (`takatak.ca` still resolves to MochaHost).

## HTTPS for coolify.takatak.ca

No DNS change was required. `coolify.takatak.ca` already has an A record to `31.220.96.134`. `dashboard.takatak.ca`, `api.takatak.ca`, `takatak.ca`, and the MX record (`0 mail.takatak.ca`) were not edited.

`https://coolify.takatak.ca` returns HTTP/2 302 to `https://coolify.takatak.ca/login`. The certificate is Let's Encrypt (issuer `YR1`), subject `CN=coolify.takatak.ca`, valid from 2026-10-03 through 2027-01-01. The proxy is the existing `traefik:v3.6` container. HTTP on that host redirects to HTTPS.

## Temporary ports bound to localhost

After that HTTPS check, Docker was still publishing 8000, 6001, 6002, and 8080 on `0.0.0.0` and `::`, which bypasses UFW. Those four publishes were changed to `127.0.0.1` only:

- `/data/coolify/proxy/docker-compose.yml`: `127.0.0.1:8080:8080`. Ports 80 and 443 stayed on all interfaces.
- `/data/coolify/source/docker-compose.prod.yml`: Coolify UI `127.0.0.1:8000` and realtime `127.0.0.1:6001` and `127.0.0.1:6002`.

`coolify`, `coolify-realtime`, and `coolify-proxy` were recreated. `coolify-db` and `coolify-redis` were not recreated and are still unpublished (5432 and 6379 are container-only). Host listeners for 8000, 6001, 6002, and 8080 are `127.0.0.1` only. Public checks to those ports, and to 5432 and 6379, do not connect. TCP 22, 80, and 443 still accept connections. A fresh `takatak` login after the recreate still works, and `sudo -n whoami` returns `root`. `https://coolify.takatak.ca` still returns 302 to `/login`.

Backups of the compose files before the edit are on the server under `/data/coolify/proxy/backups/` and `/data/coolify/source/docker-compose.prod.yml.bak-*`. They are not in git.

## Platform check

`takatak-platform-check` is one `nginx:alpine` container on the Docker network `coolify`. It has no host port publish. Traefik routes `platform-check.31.220.96.134.sslip.io` to it and issues a Let's Encrypt certificate (issuer `YR1`, subject that hostname, valid from 2026-10-05 through 2027-01-03).

Checks that passed:

- `https://platform-check.31.220.96.134.sslip.io/` returns 200 and the body `takatak-platform-check`
- HTTP on that host returns 307 to HTTPS
- Another container on the `coolify` network can fetch `http://takatak-platform-check/` and gets the same body
- `https://coolify.takatak.ca` still returns 302 to `/login`

This did not deploy TAKATAK. The hostname is sslip.io, not a customer name.

## GROUPE TAKATAK environments

Project `GROUPE TAKATAK` (id 3) was already present. Its production environment stayed in place. The other environment was named `stagging`. That row was renamed to `staging` (id 4). Applications that were attached to it stayed attached. Production workers were not started.

`takatak-server` still has its own production environment and the nginx platform-check application. It is separate from `GROUPE TAKATAK`.

Coolify's localhost server SSH user is `takatak`, using the existing Coolify localhost key (fingerprint `SHA256:P34ay03uEPvOmbjR/YeBOpHKynoea3VGh8le2iqeRpg`). That public key is in the `takatak` authorized keys. Root SSH from the public internet is still refused. `takatak` can traverse `/data/coolify` through an ACL so Coolify can write application and database files without a root login.

## takatak-redis-staging

Private Coolify Redis on the `GROUPE TAKATAK` staging environment only. Production has no Redis resource, so the two environments do not share one.

| Setting | Value |
| --- | --- |
| Name | `takatak-redis-staging` |
| Image | `redis:7.4-alpine` |
| Container | `zs9l2zadojtedmddk3rlfz2q` |
| AOF | `appendonly yes`, `appendfsync everysec` |
| Eviction | `maxmemory 256mb`, `maxmemory-policy noeviction` |
| Auth | required (`NOAUTH` without the password) |
| Public | `is_public` false, no public port, no hostname |
| Host publish | none. Nothing listens on host 6379 or 5432 |

Docker reports the container healthy. The password stays in Coolify's environment storage and was not copied into git. No application environment variable is named `REDIS_URL` yet.

## Production left where it is

The production application `takatak-v1` in `GROUPE TAKATAK` is exited. Its Coolify FQDN is `https://takatak.ca`, and public DNS for `takatak.ca` still points at MochaHost (`209.42.24.127`). `dashboard.takatak.ca` and `api.takatak.ca` have no A record. MX is still `0 mail.takatak.ca`. None of those records were changed. No production worker container is running.

The staging web application in `GROUPE TAKATAK` / `staging` now tracks `infra/contabo-coolify` at `6ac24e6`. It uses the root Dockerfile. Its runtime `REDIS_URL` points only at `takatak-redis-staging` on the private Docker network. `TAKATAK_QUEUE_ENABLED` and `TAKATAK_QUEUE_WEBHOOKS` are false. `https://staging.takatak.ca/api/health/ready` returns ok for the database, Supabase, and Redis. The production application is still exited on `main`. No worker container is running.

## Staging workers

Three Coolify applications exist in `GROUPE TAKATAK` / `staging`. They were not deployed and have no containers.

| Resource | Start command | `TAKATAK_PROCESS` | Public URL | Auto deploy |
| --- | --- | --- | --- | --- |
| `takatak-worker-general` | `npm run worker:general` | `general` | none | off |
| `takatak-worker-social` | `npm run worker:social` | `social` | none | off |
| `takatak-worker-webhooks` | `npm run worker:webhooks` | `webhooks` | none | off |

Each one uses `takatak-redis-staging` only (`redis` on that container's private port 6379). `TAKATAK_QUEUE_ENABLED` and `TAKATAK_QUEUE_WEBHOOKS` are false. `TAKATAK_QUEUE_PREFIX` is `takatak-staging`. No host port is published. Production workers were not created or started.
