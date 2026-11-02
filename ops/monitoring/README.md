# HTTPS monitoring worker

Standard-library Python worker for operator-approved public HTTPS homepages. No public API or inbound port. Signed: Codex MONITOR.

## Behavior

- Check each configured hostname every five minutes; require 2xx at `/`.
- Persist observations and incident state in SQLite across restarts.
- Queue DOWN after three consecutive failures and RECOVERED after two successes.
- Retry owner-email alerts over authenticated STARTTLS SMTP. Missing SMTP leaves notices queued.
- Write current/previous UTC month CSV reports each cycle with observed-check success and sample coverage; retain samples for 400 days.
- Block private/reserved/multicast DNS results; pin the validated address and verify TLS against the original hostname. Never follow redirects or store response bodies.

## Local checks

```bash
python3 -m unittest discover -s ops/monitoring -p 'test_*.py' -v
python3 ops/monitoring/monitor.py validate --config ops/monitoring/sites.json
```

The committed `example.com` configuration is an example, not an enrolled customer. Put approved target hostnames in the host-local configuration before rebuilding.

## Deployment

Use an independent host outside the monitored websites' failure domain. Inside `ops/monitoring`, copy `.env.example` to `.env`, set permissions with `chmod 600 .env` and fill sender credentials and the operator's alert inbox privately. STARTTLS on port 587 is supported; implicit TLS on 465 is not. Do not commit credentials, inbox addresses, observations or reports.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose logs --tail=30 monitor
# Export a selected UTC month's report:
docker compose exec monitor python monitor.py report --data /data --month 2026-11
docker compose cp monitor:/data/reports/2026-11.csv ./2026-11.csv
# Stop without deleting history:
docker compose stop monitor
```

Verify controlled incident/recovery email delivery, volume persistence and an independent external watchdog before relying on monitoring. This worker cannot notify you when its own host stops. Never use `down -v` unless deleting observation history is intended. Pin the reviewed base-image digest for production after verifying it.

## Interpretation and limits

A homepage 2xx proves HTTP reachability only, not checkout, authentication, APIs or content correctness. Redirects count as failures; configure the verified canonical hostname. TLS certificates are verified, but advance expiry warnings are not implemented.

Three failed checks confirm an incident in roughly 10–15 minutes plus network delays. Only the first public DNS address is attempted; DNS timing is OS-dependent. Missing periods are unknown. CSV percentages describe sampled checks, not continuous uptime or an SLA. Coverage uses the current interval and whole month; partial-month enrollment appears as partial coverage. Keep configuration/enrollment records separately.

SMTP is at least once: a crash after server acceptance can duplicate a notice despite a stable Message-ID. Monthly CSV creation is automatic; email report distribution, customer signup, billing and a dashboard are outside this package. Reports and outbox require operator retention management; back up the persistent volume.

## Validation evidence

13 local behavioral tests passed. Network probes from the restricted development runner were inconclusive; live site availability and email delivery are unverified. Docker is unavailable locally; the dedicated GitHub CI job validates Compose and builds the image. No production deployment is claimed.
