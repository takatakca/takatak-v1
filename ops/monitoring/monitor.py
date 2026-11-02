"""TAKATAK owner-operated HTTPS monitoring pilot. Standard library only.

Signed: Codex MONITOR. No public API, customer credentials or billing access.
"""
import argparse
import csv
import hashlib
import hmac
import datetime as dt
import http.client
import ipaddress
import json
import os
from pathlib import Path
import smtplib
import socket
import sqlite3
import ssl
import time
import uuid
from email.message import EmailMessage

UTC = dt.timezone.utc


def load_config(path):
    config = json.loads(Path(path).read_text())
    interval = config.get("interval_seconds", 300)
    if type(interval) is not int or not 60 <= interval <= 3600:
        raise ValueError("interval_seconds must be an integer between 60 and 3600")
    sites = config.get("sites")
    if not isinstance(sites, list) or not 1 <= len(sites) <= 50:
        raise ValueError("configure 1 to 50 owner-approved sites")
    seen = set()
    for site in sites:
        host = site.get("hostname", "")
        # Operator-managed hostnames only; no URL, port, IP, path or credentials.
        labels = host.split(".")
        if (not host.isascii() or host != host.lower() or len(host) > 253
                or len(labels) < 2 or any(not label or len(label) > 63
                or label.startswith("-") or label.endswith("-")
                or not all(c.isalnum() or c == "-" for c in label) for label in labels)):
            raise ValueError("invalid public DNS hostname")
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            raise ValueError("IP literals are not allowed")
        if host in seen:
            raise ValueError("duplicate hostname")
        seen.add(host)
        if "domain_asset_id" in site or "sync_key_env" in site:
            uuid.UUID(site.get("domain_asset_id", ""))
            key_env = site.get("sync_key_env", "")
            if not key_env.startswith("MONITORING_KEY_") or not all(c.isupper() or c.isdigit() or c == "_" for c in key_env):
                raise ValueError("sync_key_env must name a MONITORING_KEY_ environment variable")
    return config


class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, hostname, address):
        super().__init__(hostname, timeout=10, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        # Pin the validated public DNS result; preserve TLS hostname verification.
        raw = socket.create_connection((self.address, 443), timeout=self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def probe(hostname, resolver=socket.getaddrinfo, connection=PinnedHTTPS):
    started = time.monotonic()
    conn = None
    try:
        answers = resolver(hostname, 443, type=socket.SOCK_STREAM)
        addresses = list(dict.fromkeys(answer[4][0] for answer in answers))
        if not addresses or any(not ipaddress.ip_address(ip).is_global
                                or ipaddress.ip_address(ip).is_multicast for ip in addresses):
            return False, None, 0, "blocked_address"
        conn = connection(hostname, addresses[0])
        conn.request("GET", "/", headers={"User-Agent": "TAKATAK-Monitor/0.1", "Connection": "close"})
        response = conn.getresponse()
        status = response.status
        # No redirects followed, no response body downloaded/stored.
        return 200 <= status < 300, status, round((time.monotonic() - started) * 1000), "http"
    except (OSError, ssl.SSLError, http.client.HTTPException, ValueError):
        return False, None, round((time.monotonic() - started) * 1000), "network_or_tls"
    finally:
        if conn:
            conn.close()


def open_db(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS samples (
            host TEXT NOT NULL, at INTEGER NOT NULL, ok INTEGER NOT NULL,
            status INTEGER, latency_ms INTEGER NOT NULL, reason TEXT NOT NULL,
            PRIMARY KEY (host, at));
        CREATE TABLE IF NOT EXISTS state (
            host TEXT PRIMARY KEY, stable TEXT NOT NULL,
            failures INTEGER NOT NULL, successes INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS outbox (
            id INTEGER PRIMARY KEY, host TEXT NOT NULL, at INTEGER NOT NULL,
            event TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0);
    """)
    return db


def record(db, host, at, result, interval=300):
    ok, status, latency, reason = result
    with db:
        last = db.execute("SELECT MAX(at) FROM samples WHERE host=?", (host,)).fetchone()[0]
        if last is not None and at < last:
            raise ValueError("observations must be chronological")
        changed = db.execute("INSERT OR IGNORE INTO samples VALUES (?,?,?,?,?,?)",
                             (host, at, int(ok), status, latency, reason)).rowcount
        if not changed:
            return  # A repeated observation cannot count toward a threshold.
        row = db.execute("SELECT stable, failures, successes FROM state WHERE host=?", (host,)).fetchone()
        stable, failures, successes = row or ("unknown", 0, 0)
        if last is not None and at - last > interval * 2:
            failures, successes = 0, 0
        failures, successes = (0, successes + 1) if ok else (failures + 1, 0)
        event = None
        if failures >= 3 and stable != "down":
            stable, event = "down", "DOWN"
        elif successes >= 2 and stable != "up":
            event = "RECOVERED" if stable == "down" else None
            stable = "up"
        db.execute("INSERT OR REPLACE INTO state VALUES (?,?,?,?)", (host, stable, failures, successes))
        if event:
            db.execute("INSERT INTO outbox(host,at,event) VALUES (?,?,?)", (host, at, event))
            print(json.dumps({"host": host, "at": at, "event": event}), flush=True)


def deliver(db, env=os.environ, smtp_factory=smtplib.SMTP):
    required = ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MONITOR_FROM", "MONITOR_TO")
    if not all(env.get(key) for key in required):
        return False  # Persistent queue remains unsent; never claim delivery.
    pending = db.execute("SELECT id,host,at,event FROM outbox WHERE sent=0 ORDER BY id LIMIT 20").fetchall()
    if not pending:
        return True
    try:
        with smtp_factory(env["SMTP_HOST"], int(env.get("SMTP_PORT", "587")), timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(env["SMTP_USER"], env["SMTP_PASSWORD"])
            for alert_id, host, at, event in pending:
                message = EmailMessage()
                message["From"], message["To"] = env["MONITOR_FROM"], env["MONITOR_TO"]
                message["Subject"] = f"TAKATAK Monitor: {event} {host}"
                message["Message-ID"] = f"<takatak-monitor-{host}-{at}-{event}@{host}>"
                message.set_content(f"{event}: https://{host}/\nObserved: {dt.datetime.fromtimestamp(at, UTC).isoformat()}\n"
                                    "Confirmed by consecutive checks. Verify the website before acting.\nSigned: Codex MONITOR\n")
                if smtp.send_message(message):
                    raise smtplib.SMTPException("recipient refused")
                with db:
                    db.execute("UPDATE outbox SET sent=1 WHERE id=?", (alert_id,))
        return True
    except (OSError, smtplib.SMTPException, ValueError):
        print("SMTP delivery failed; alerts retained for retry", flush=True)
        return False


def report(db, month, output, config):
    start = dt.datetime.strptime(month, "%Y-%m").replace(tzinfo=UTC)
    end = (start.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    begin, finish = int(start.timestamp()), int(end.timestamp())
    rows = db.execute("""SELECT host, COUNT(*), SUM(ok), ROUND(AVG(latency_ms),1)
        FROM samples WHERE at>=? AND at<? GROUP BY host ORDER BY host""", (begin, finish)).fetchall()
    by_host = {row[0]: row for row in rows}
    now = int(time.time())
    expected = max(0, min(now, finish) - begin) // config["interval_seconds"]
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix(".tmp")
    with temp.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["month_utc", "hostname", "observed_checks", "successful_checks",
                         "sample_success_percent", "expected_checks_to_date", "sample_coverage_percent",
                         "mean_check_ms"])
        hosts = set(by_host) | {site["hostname"] for site in config["sites"]}
        for host in sorted(hosts):
            _, count, successes, latency = by_host.get(host, (host, 0, 0, ""))
            writer.writerow([month, host, count, successes,
                             round(100 * successes / count, 3) if count else "",
                             expected, round(100 * count / expected, 3) if expected else "", latency])
    temp.replace(output)


def dashboard_request(site, payload, env=os.environ, connection=PinnedHTTPS, resolver=socket.getaddrinfo):
    """Per-domain authenticated exchange. No login database or payment credentials in worker."""
    if env.get("DASHBOARD_SYNC_ENABLED") != "true":
        return None
    secret = env.get(site.get("sync_key_env", ""), "")
    if len(secret) != 64 or any(c not in "0123456789abcdef" for c in secret):
        return None
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(bytes.fromhex(secret), timestamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
    conn = None
    try:
        addresses = [answer[4][0] for answer in resolver("takatak.ca", 443, type=socket.SOCK_STREAM)]
        if not addresses or any(not ipaddress.ip_address(ip).is_global or ipaddress.ip_address(ip).is_multicast for ip in addresses):
            return None
        conn = connection("takatak.ca", addresses[0])
        conn.request("POST", "/api/integrations/monitoring/snapshot", body=raw,
                     headers={"Content-Type": "application/json", "x-monitor-timestamp": timestamp,
                              "x-monitor-signature": signature, "Connection": "close"})
        response = conn.getresponse()
        body = response.read(8193)
        if response.status != 200 or len(body) > 8192:
            return None
        result = json.loads(body)
        return result if isinstance(result, dict) and result.get("ok") is True else None
    except (OSError, http.client.HTTPException, ValueError):
        return None
    finally:
        if conn:
            conn.close()


def snapshot_payload(db, site, at, result, interval):
    now = dt.datetime.fromtimestamp(at, UTC)
    first = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    previous = (first - dt.timedelta(days=1)).replace(day=1)
    months = []
    for start in (previous, first):
        end = (start.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        count, successes, mean = db.execute("SELECT COUNT(*),SUM(ok),AVG(latency_ms) FROM samples WHERE host=? AND at>=? AND at<?",
                                          (site["hostname"], int(start.timestamp()), int(end.timestamp()))).fetchone()
        months.append({"month": start.strftime("%Y-%m"), "checks": count, "successes": successes or 0, "meanMs": round(mean or 0, 1)})
    stable = db.execute("SELECT stable FROM state WHERE host=?", (site["hostname"],)).fetchone()[0]
    return {"domainAssetId": site["domain_asset_id"], "hostname": site["hostname"], "observedAt": at,
            "intervalSeconds": interval, "stable": stable, "ok": result[0], "status": result[1],
            "latencyMs": result[2], "reason": result[3], "months": months}


def run_cycle(db, config, output, probe_fn=probe, dashboard_fn=dashboard_request):
    for site in config["sites"]:
        if site.get("domain_asset_id"):
            authorization = dashboard_fn(site, {"kind": "authorization", "domainAssetId": site["domain_asset_id"], "hostname": site["hostname"]})
            if not authorization or authorization.get("enabled") is not True:
                print(json.dumps({"host": site["hostname"], "monitoring": "awaiting_authorization"}), flush=True)
                continue  # Failed/expired payment or unavailable authorization never enables paid checks.
        at = int(time.time())
        result = probe_fn(site["hostname"])
        record(db, site["hostname"], at, result, config["interval_seconds"])
        if site.get("domain_asset_id"):
            if not dashboard_fn(site, snapshot_payload(db, site, at, result, config["interval_seconds"])):
                print(json.dumps({"host": site["hostname"], "dashboard_sync": "retry_next_cycle"}), flush=True)
    deliver(db)
    now = dt.datetime.now(UTC)
    previous = (now.replace(day=1) - dt.timedelta(days=1)).strftime("%Y-%m")
    for month in (previous, now.strftime("%Y-%m")):
        report(db, month, Path(output) / f"{month}.csv", config)
    with db:
        db.execute("DELETE FROM samples WHERE at<?", (int(time.time()) - 400 * 86400,))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("validate", "once", "watch", "report"))
    parser.add_argument("--config", default="sites.json")
    parser.add_argument("--data", default="data")
    parser.add_argument("--month")
    args = parser.parse_args()
    config = load_config(args.config)
    config.setdefault("interval_seconds", 300)
    if args.command == "validate":
        print(f"Valid configuration: {len(config['sites'])} sites")
        return
    with open_db(Path(args.data) / "monitor.sqlite3") as db:
        if args.command == "report":
            if not args.month:
                parser.error("report requires --month YYYY-MM")
            report(db, args.month, Path(args.data) / "reports" / f"{args.month}.csv", config)
            return
        while True:
            started = time.monotonic()
            run_cycle(db, config, Path(args.data) / "reports")
            pending = db.execute("SELECT COUNT(*) FROM outbox WHERE sent=0").fetchone()[0]
            print(json.dumps({"last_cycle_utc": dt.datetime.now(UTC).isoformat(),
                              "checked": len(config["sites"]), "pending_alerts": pending,
                              "smtp_configured": all(os.environ.get(key) for key in
                                  ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MONITOR_FROM", "MONITOR_TO"))}), flush=True)
            if args.command == "once":
                break
            time.sleep(max(1, config["interval_seconds"] - (time.monotonic() - started)))


if __name__ == "__main__":
    main()
