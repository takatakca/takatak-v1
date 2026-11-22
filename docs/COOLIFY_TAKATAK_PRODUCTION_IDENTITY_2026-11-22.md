# TAKATAK.ca — current Coolify production application identity (2026-11-22)

**Read-only observation / operator runbook.** Signed: GPT-6 @ ChatGPT, 2026-11-22.  
**Source baseline:** `main` `5a3061f8e093cb1acfd868c2ac11079cdba95b98`.

## What was observed in the authenticated Coolify browser on 2026-11-22

- Project: **GROUPE TAKATAK**; environment: **production**.
- Existing **running** application: `takatak-v1:main-cu7j0hwri5jmgri2gozfqc6v`.
- Current application UUID: **`cu7j0hwri5jmgri2gozfqc6v`**.
- Server displayed: **`vps1`**.
- App UI displays **Container: Running**, **Healthcheck: Healthy**, and links for `https://takatak.ca/`, `https://www.takatak.ca/` and `https://api.takatak.ca/`.
- App deployment history includes the latest `5a3061f` webhook, `02dbcef` manual and webhook attempts, and prior `380b0d0` (renewal notice PR #384). The opened `02dbcef` deployment log explicitly showed a successful Docker build, healthcheck `healthy`, proxy traffic transition and the same resource UUID.
- Coolify app (operator session): https://coolify.takatak.ca/project/uags00ppu3k6traitprcqlms/environment/aeenvjmmycmmrvmvfv1rarhf/application/cu7j0hwri5jmgri2gozfqc6v
- GitHub source: https://github.com/takatakca/takatak-v1, branch `main`.
- Historical `docs/DEPLOYMENT.md` and `docs/PROJECT_STATUS.md` dated 2026-11-07 named **`lt05flq7furdzxfqtmfmujek`** on VPS1 at historical IP `209.145.49.63`. These are **historical snapshots, not the current app locator**. The old UUID's present existence, routing and safe-removal status have **not** been checked. Do not delete it from this evidence alone.

## Evidence limitations

- The open Coolify view is authenticated and shows a healthy app and deployment records, but this is **not yet independent proof** of the exact image/release being served to every public hostname. Do not infer production runtime SHA from main HEAD or from a successful build. The `5a3061f` webhook is listed, but this observation did not open its detailed result to certify that exact SHA.
- The Coolify UI also displays `Cannot connect to real-time service`; its `vps1` Terminal page says `Could not connect to the terminal server. Reload the page and try again.` These are terminal/realtime observation failures, not by themselves evidence that web traffic is down.
- **Historical server/IP records contradict each other.** The 2026-11-04 Google Drive master hosting file “2026-11-04 — TAKATAK hosting (MochaHost → Coolify) — MAIN FILE” lists **vps1 = 31.220.96.134** and **vps2 = 209.145.49.63**; the 2026-11-07 GitHub `docs/DEPLOYMENT.md` instead calls **209.145.49.63** “VPS1”. Therefore neither historical IP-to-label pairing is safe for a DNS/proxy change. Check live Coolify server Configuration and authoritative DNS independently before claiming which physical machine serves a hostname.
- No current public DNS A/AAAA response or public `X-TAKATAK-Release` header was independently observed by this session. Do not copy the historical IP into new routing/DNS configuration. No shell, SSH, Coolify API or proxy configuration changes were made.

## Exact steps before any cleanup

1. Keep the **`cu7j0hwri5jmgri2gozfqc6v`** application running. In its Coolify General settings, verify repository `takatakca/takatak-v1`, branch `main`, three linked hostnames, server destination `vps1`, and current healthcheck.
2. Open its deployment history. Inspect the **latest webhook** for `5a3061f` and verify status **Success**, the container healthcheck and active revision; never confuse an earlier `02dbcef` successful deployment with the later webhook.
3. In an operator machine that has DNS and HTTPS access, record `A/AAAA` values for `takatak.ca`, `www.takatak.ca`, and `api.takatak.ca`. Record HTTP response status, TLS, `X-TAKATAK-Release`, `/api/health/ready` and whether the release matches the intended GitHub SHA. Check both aliases and API routing; do **not** edit DNS to make an expected answer appear.
4. In Coolify inspect **all** projects and servers for additional `takatak-v1` entries, especially historical UUID `lt05flq7furdzxfqtmfmujek` and any `vps2` installation. Compare each application's bound domains, proxy labels, server destination, deployment history, persistent volumes, scheduled tasks, database references, webhooks and environment variable *names* (not values). Maintain an inventory before any deletion.
5. Confirm only one authorized production app claims each TAKATAK hostname; avoid multiple active matching proxy routes. Distinguish `vps1/vps2` UI names from actual validated host IPs.
6. Preserve existing backups, rollback image and runtime settings. Remove/decommission duplicates **only after** positive proof they serve no traffic, are not needed by workers/schedulers and have no unique data, plus a rollback plan and explicit owner decision. Never stop the healthy app or restart the shared Coolify proxy as a cleanup shortcut.
7. For domain-renewal notices from PR #384, `TAKATAK_DOMAIN_RENEWAL_NOTICES_ENABLED` remains **OFF by default**. Do not enable without verified same-tenant domain mapping, controlled tests and owner-reviewed pricing; no payment or client website changes implied.

**No staging application is required for this read-only audit.** Current evidence supports the target application ID, not a claim that all customer-facing integrations are live.
