"""Behavioral coverage: incident thresholds, delivery retries, reporting, network isolation."""
import csv
import datetime as dt
import json
import hashlib
import hmac
from pathlib import Path
import smtplib
import sqlite3
import tempfile
import unittest
from unittest.mock import Mock

import monitor

GOOD = (True, 200, 15, "http")
BAD = (False, 503, 20, "http")
CONFIG = {"interval_seconds": 300, "sites": [{"hostname": "example.com"}]}


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.db = monitor.open_db(self.root / "monitor.sqlite3")
        self.addCleanup(self.db.close)

    def observe(self, results, start=1000):
        for i, result in enumerate(results):
            monitor.record(self.db, "example.com", start + i * 300, result)

    def events(self):
        return self.db.execute("SELECT event FROM outbox ORDER BY id").fetchall()

    def test_transient_failure_does_not_alert(self):
        self.observe([GOOD, GOOD, BAD, BAD, GOOD])
        self.assertEqual(self.events(), [])

    def test_one_incident_and_one_recovery(self):
        self.observe([BAD, BAD, BAD, BAD, GOOD, GOOD, GOOD])
        self.assertEqual(self.events(), [("DOWN",), ("RECOVERED",)])

    def test_restart_preserves_streak_and_does_not_repeat_incident(self):
        self.observe([BAD, BAD])
        with monitor.open_db(self.root / "monitor.sqlite3") as other:
            monitor.record(other, "example.com", 1600, BAD)
            monitor.record(other, "example.com", 1900, BAD)
        self.assertEqual(self.events(), [("DOWN",)])

    def test_duplicate_does_not_confirm_failure(self):
        for _ in range(4):
            monitor.record(self.db, "example.com", 1000, BAD)
        self.assertEqual(self.events(), [])

    def test_monitoring_gap_resets_confirmation(self):
        self.observe([BAD, BAD])
        monitor.record(self.db, "example.com", 5000, BAD)
        self.assertEqual(self.events(), [])

    def test_backwards_clock_rejected(self):
        self.observe([GOOD])
        with self.assertRaises(ValueError):
            monitor.record(self.db, "example.com", 999, BAD)

    def test_missing_smtp_keeps_alert_pending(self):
        self.observe([BAD] * 3)
        self.assertFalse(monitor.deliver(self.db, {}))
        self.assertEqual(self.db.execute("SELECT sent FROM outbox").fetchone()[0], 0)

    def test_smtp_failure_is_retried_with_same_message_id(self):
        self.observe([BAD] * 3)
        env = dict.fromkeys(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MONITOR_FROM", "MONITOR_TO"], "owner@example.com")
        smtp = Mock()
        smtp.__enter__ = Mock(return_value=smtp)
        smtp.__exit__ = Mock(return_value=False)
        smtp.send_message.side_effect = [smtplib.SMTPException("offline"), {}]
        factory = Mock(return_value=smtp)
        self.assertFalse(monitor.deliver(self.db, env, factory))
        self.assertTrue(monitor.deliver(self.db, env, factory))
        ids = [call.args[0]["Message-ID"] for call in smtp.send_message.call_args_list]
        self.assertEqual(ids[0], ids[1])
        self.assertEqual(smtp.starttls.call_count, 2)
        self.assertEqual(self.db.execute("SELECT sent FROM outbox").fetchone()[0], 1)

    def test_alert_names_configured_probe_path(self):
        for offset in range(3):
            monitor.record(self.db, "takatak.ca", 1000 + offset * 300, BAD, path="/api/health/ready")
        self.assertEqual(self.db.execute("SELECT path FROM outbox").fetchone()[0], "/api/health/ready")
        env = dict.fromkeys(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MONITOR_FROM", "MONITOR_TO"], "owner@example.com")
        smtp = Mock()
        smtp.__enter__ = Mock(return_value=smtp)
        smtp.__exit__ = Mock(return_value=False)
        smtp.send_message.return_value = {}
        self.assertTrue(monitor.deliver(self.db, env, Mock(return_value=smtp)))
        message = smtp.send_message.call_args.args[0]
        self.assertEqual(message["Subject"], "TAKATAK Monitor: DOWN takatak.ca/api/health/ready")
        self.assertIn("https://takatak.ca/api/health/ready\n", message.get_content())
        self.assertNotIn("https://takatak.ca/\n", message.get_content())

    def test_legacy_outbox_defaults_missing_probe_path(self):
        legacy = sqlite3.connect(self.root / "legacy.sqlite3")
        legacy.executescript("""
            CREATE TABLE samples (
                host TEXT NOT NULL, at INTEGER NOT NULL, ok INTEGER NOT NULL,
                status INTEGER, latency_ms INTEGER NOT NULL, reason TEXT NOT NULL,
                PRIMARY KEY (host, at));
            CREATE TABLE state (
                host TEXT PRIMARY KEY, stable TEXT NOT NULL,
                failures INTEGER NOT NULL, successes INTEGER NOT NULL);
            CREATE TABLE outbox (
                id INTEGER PRIMARY KEY, host TEXT NOT NULL, at INTEGER NOT NULL,
                event TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0);
        """)
        legacy.execute("INSERT INTO outbox(host,at,event) VALUES ('example.com', 1, 'DOWN')")
        legacy.commit()
        legacy.close()
        db = monitor.open_db(self.root / "legacy.sqlite3")
        self.addCleanup(db.close)
        self.assertEqual(db.execute("SELECT path FROM outbox").fetchone()[0], "/")

    def test_month_boundaries_and_unknown_site_coverage(self):
        at = int(dt.datetime(2026, 10, 31, 23, 55, tzinfo=monitor.UTC).timestamp())
        self.observe([GOOD, BAD], at)
        config = {**CONFIG, "sites": CONFIG["sites"] + [{"hostname": "missing.example.com"}]}
        output = self.root / "report.csv"
        monitor.report(self.db, "2026-10", output, config)
        with output.open() as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual(rows[0]["observed_checks"], "1")
        self.assertEqual(rows[0]["sample_success_percent"], "100.0")
        self.assertEqual(rows[1]["observed_checks"], "0")
        self.assertEqual(rows[1]["sample_success_percent"], "")
        self.assertEqual(rows[1]["sample_coverage_percent"], "0.0")

    def test_config_rejects_unsafe_targets_duplicates_and_tight_loop(self):
        for host in ["localhost", "127.0.0.1", "https://example.com", "a.example.com:443", "a/b.example.com", "a\n.example.com"]:
            path = self.root / "sites.json"
            path.write_text(json.dumps({"sites": [{"hostname": host}]}))
            with self.assertRaises(ValueError, msg=host):
                monitor.load_config(path)
        for config in [{**CONFIG, "interval_seconds": 1}, {**CONFIG, "sites": CONFIG["sites"] * 2}]:
            path.write_text(json.dumps(config))
            with self.assertRaises(ValueError):
                monitor.load_config(path)

    def test_dns_private_mixed_and_metadata_addresses_blocked(self):
        for addresses in [["127.0.0.1"], ["169.254.169.254"], ["::1"], ["224.0.0.1"], ["ff0e::1"], ["93.184.216.34", "10.0.0.1"]]:
            resolver = Mock(return_value=[(2, 1, 6, "", (ip, 443)) for ip in addresses])
            factory = Mock()
            self.assertEqual(monitor.probe("example.com", resolver, factory)[3], "blocked_address")
            factory.assert_not_called()

    def test_redirect_not_followed_and_body_not_read(self):
        resolver = Mock(return_value=[(2, 1, 6, "", ("93.184.216.34", 443))])
        conn = Mock()
        conn.getresponse.return_value.status = 302
        factory = Mock(return_value=conn)
        result = monitor.probe("example.com", resolver, factory)
        self.assertFalse(result[0])
        factory.assert_called_once_with("example.com", "93.184.216.34")
        conn.getresponse.return_value.read.assert_not_called()
        conn.request.assert_called_once()
        self.assertEqual(conn.request.call_args.args[0], "GET")
        self.assertEqual(conn.request.call_args.args[1], "/")
        conn.close.assert_called_once()

    def test_health_path_is_requested_and_unsafe_paths_fail_closed(self):
        resolver = Mock(return_value=[(2, 1, 6, "", ("93.184.216.34", 443))])
        conn = Mock()
        conn.getresponse.return_value.status = 200
        self.assertTrue(monitor.probe("takatak.ca", resolver, Mock(return_value=conn), "/api/health/ready")[0])
        self.assertEqual(conn.request.call_args.args[1], "/api/health/ready")
        self.assertEqual(monitor.probe("takatak.ca", resolver, Mock(), "https://takatak.ca")[3], "invalid_path")
        path = self.root / "sites.json"
        path.write_text(json.dumps({"sites": [{"hostname": "takatak.ca", "path": "/api/health?full=1"}]}))
        with self.assertRaises(ValueError):
            monitor.load_config(path)

    def test_successful_https_probe(self):
        resolver = Mock(return_value=[(2, 1, 6, "", ("93.184.216.34", 443))])
        conn = Mock()
        conn.getresponse.return_value.status = 200
        self.assertTrue(monitor.probe("example.com", resolver, Mock(return_value=conn))[0])

    def test_paid_monitor_checks_require_current_dashboard_authorization(self):
        site = {"hostname": "example.com", "domain_asset_id": "a1111111-1111-4111-8111-111111111111", "sync_key_env": "MONITORING_KEY_EXAMPLE"}
        probe = Mock(return_value=GOOD)
        for authorization in [None, {"ok": True, "enabled": False}]:
            monitor.run_cycle(self.db, {**CONFIG, "sites": [site]}, self.root / "reports", probe, Mock(return_value=authorization))
        probe.assert_not_called()
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM samples").fetchone()[0], 0)
        dashboard = Mock(side_effect=[{"ok": True, "enabled": True}, {"ok": True, "accepted": True}])
        monitor.run_cycle(self.db, {**CONFIG, "sites": [site]}, self.root / "reports", probe, dashboard)
        probe.assert_called_once_with("example.com", path="/")
        snapshot = dashboard.call_args_list[1].args[1]
        self.assertEqual(snapshot["domainAssetId"], site["domain_asset_id"])
        self.assertEqual(snapshot["ok"], True)
        self.assertEqual(snapshot["months"][1]["checks"], 1)

    def test_sync_is_signed_with_per_domain_secret_and_fixed_https_destination(self):
        conn = Mock()
        conn.getresponse.return_value.status = 200
        conn.getresponse.return_value.read.return_value = b'{"ok":true,"enabled":true}'
        resolver = Mock(return_value=[(2, 1, 6, "", ("93.184.216.34", 443))])
        factory = Mock(return_value=conn)
        site = {"sync_key_env": "MONITORING_KEY_EXAMPLE"}
        env = {"DASHBOARD_SYNC_ENABLED": "true", "MONITORING_KEY_EXAMPLE": "1a" * 32}
        payload = {"domainAssetId": "a1111111-1111-4111-8111-111111111111", "kind": "authorization", "hostname": "example.com"}
        self.assertTrue(monitor.dashboard_request(site, payload, env, factory, resolver)["enabled"])
        factory.assert_called_once_with("takatak.ca", "93.184.216.34")
        args = conn.request.call_args
        self.assertEqual(args.args[:2], ("POST", "/api/integrations/monitoring/snapshot"))
        headers, raw = args.kwargs["headers"], args.kwargs["body"]
        expected = hmac.new(bytes.fromhex(env["MONITORING_KEY_EXAMPLE"]), headers["x-monitor-timestamp"].encode() + b"." + raw, hashlib.sha256).hexdigest()
        self.assertEqual(headers["x-monitor-signature"], expected)
        self.assertNotIn(env["MONITORING_KEY_EXAMPLE"], str(args))

    def test_french_report_does_not_claim_delivery_without_smtp(self):
        self.observe([BAD, BAD, BAD])
        text = monitor.french_daily_report(self.db, CONFIG, dt.datetime(2026, 11, 7, 12, tzinfo=monitor.UTC), {})
        self.assertIn("example.com", text)
        self.assertIn("down", text)
        self.assertIn("non configurée", text)
        self.assertNotIn("livré avec succès", text)

    def test_sync_fails_closed_without_credentials(self):
        factory = Mock()
        self.assertIsNone(monitor.dashboard_request({}, {}, {}, factory))
        factory.assert_not_called()


if __name__ == "__main__":
    unittest.main()
