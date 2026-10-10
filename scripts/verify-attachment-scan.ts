// TK-065: lead attachments are scanned, stay quarantined, and only a clean file can be downloaded.
// Run: npm run qa:attachment-scan
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { recordLeadAttachment, type AttachmentDb, type AttachmentStorage } from "../src/lib/website-leads/attachments";
import { canDownloadAttachment, EICAR_SIGNATURE, scanForMalware } from "../src/lib/website-leads/malware-scan";

let passed = 0;

function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`ok ${name}`);
  });
}

const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"));

async function main() {
  await check("a normal PDF is clean and an EICAR or program file is infected", () => {
  assert.equal(scanForMalware(PDF), "clean");
  assert.equal(scanForMalware(new Uint8Array(Buffer.from(`note\n${EICAR_SIGNATURE}\n`))), "infected");
  assert.equal(scanForMalware(new Uint8Array([0x4d, 0x5a, 0x00, 0x00])), "infected");
  assert.equal(canDownloadAttachment("quarantined"), true);
  assert.equal(canDownloadAttachment("infected"), false);
  assert.equal(canDownloadAttachment("deleted"), false);
});

await check("an infected upload is stored and refused, and a clean PDF stays quarantined", async () => {
  const lead = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const client = "11111111-1111-4111-8111-111111111111";
  const rows: Record<string, unknown>[] = [];
  const db = {
    lead: {
      async findFirst({ where }: { where: { id: string; clientId: string } }) {
        return where.id === lead && where.clientId === client ? { id: lead } : null;
      },
    },
    leadAttachment: {
      async aggregate() {
        return { _count: { _all: rows.length }, _sum: { sizeBytes: 0 } };
      },
      async create({ data }: { data: Record<string, unknown> }) {
        rows.push(data);
        return data;
      },
    },
  } as unknown as AttachmentDb;
  const storage: AttachmentStorage = {
    bucket: "private",
    async upload() {},
    async remove() {},
  };
  const clean = await recordLeadAttachment(db, storage, {
    clientId: client,
    leadId: lead,
    fileName: "brief.pdf",
    bytes: PDF,
  });
  assert.equal(clean.ok, true);
  assert.equal(rows[0]?.status, "quarantined");
  const infected = await recordLeadAttachment(db, storage, {
    clientId: client,
    leadId: lead,
    fileName: "note.txt",
    bytes: new Uint8Array(Buffer.from(EICAR_SIGNATURE)),
  });
  assert.deepEqual(infected, { ok: false, reason: "infected" });
  assert.equal(rows[1]?.status, "infected");
});

await check("download stays limited to a quarantined file in the caller's workspace", () => {
  const route = readFileSync("src/app/api/leads/attachments/[id]/route.ts", "utf8");
  const storage = readFileSync("src/lib/website-leads/attachment-storage.ts", "utf8");
  const page = readFileSync("src/app/dashboard/leads/[id]/page.tsx", "utf8");
  assert.match(route, /status: "quarantined"/);
  assert.match(storage, /download: attachment\.originalName/);
  assert.match(page, /file\.status === "quarantined"/);
  assert.doesNotMatch(route, /prisma\/migrations/);
});

  console.log(`\n${passed} attachment scan checks passed`);
}

main();
