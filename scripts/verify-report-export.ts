// TK-026: a report can be exported and delivered inside the dashboard only.
// Run: npm run qa:report-export
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { decideDelivery, internalReportPath, reportPdfLines } from "../src/lib/reports/export-document";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

check("delivery stays inside the dashboard and refuses an archived report", () => {
  assert.deepEqual(decideDelivery({ status: "archived" }, null), { action: "refuse", reason: "archived" });
  assert.deepEqual(decideDelivery({ status: "ready" }, "share-1"), { action: "already", shareId: "share-1" });
  assert.deepEqual(decideDelivery({ status: "draft" }, null), { action: "deliver" });
  const path = internalReportPath("11111111-1111-1111-1111-111111111111");
  assert.equal(path.startsWith("/dashboard/reports/preview?id="), true);
  assert.equal(path.includes("http"), false);
});

check("the PDF names the client and does not claim an email was sent", () => {
  const lines = reportPdfLines({
    title: "Sommaire mensuel",
    clientName: "Boulangerie du coin",
    summary: "Résumé interne.",
    sections: [{ title: "Résumé", content: "Les publications sont en brouillon." }],
    metrics: [{ label: "Brouillons", value: "2", unit: null }],
  });
  const text = lines.join("\n");
  assert.match(text, /Préparé pour : Boulangerie du coin/);
  assert.match(text, /Brouillons : 2/);
  assert.match(text, /Aucun courriel/);
  assert.doesNotMatch(text, /https?:\/\//);
});

check("export and delivery are scoped and add no migration", () => {
  const action = readFileSync("src/app/dashboard/reports/actions.ts", "utf8");
  const route = readFileSync("src/app/dashboard/reports/export/pdf/route.ts", "utf8");
  assert.match(action, /clientId: access\.activeClientId/);
  assert.match(action, /shared_internal/);
  assert.match(action, /report_ready/);
  assert.doesNotMatch(action, /mailto:|sendMail|nodemailer/);
  assert.match(route, /clientId: access\.activeClientId/);
  assert.doesNotMatch(route, /prisma\/migrations/);
});

console.log(`\n${passed} report export checks passed`);
