import assert from "node:assert/strict";
import test from "node:test";
import {
  auditCitations, compareNapField, exportCitationAuditCsv, parseCitationCsv,
  type BusinessNap, type CitationRow,
} from "../src/lib/local-listings/citation-audit.ts";

const reference: BusinessNap = {
  name: "Café Montréal", address: "123 Rue Saint-Paul, Montréal, QC",
  phone: "+1 (514) 555-0100", website: "https://www.example.ca/",
};
const row: CitationRow = {
  directory: "Example Directory", listingUrl: "https://directory.example/cafe",
  name: "Cafe Montreal", address: "123 Rue Saint Paul, Montreal, QC",
  phone: "514-555-0100", website: "example.ca",
};

test("normalizes accents, punctuation, North American phones and website scheme", () => {
  for (const field of ["name", "address", "phone", "website"] as const) {
    assert.equal(compareNapField(field, reference[field], row[field]), "match");
  }
});

test("marks a missing value as unverified, not a match", () => {
  assert.equal(compareNapField("phone", reference.phone, ""), "missing_in_citation");
  assert.equal(compareNapField("phone", "", row.phone), "reference_missing");
});

test("reads quoted CSV, escaped quotes, embedded line breaks and BOM", () => {
  const csv = '\uFEFFdirectory,name,address,phone,website,listing_url\r\n"Directory, Inc.","Cafe ""Montréal""","123 Rue Saint-Paul,\nMontréal, QC",514-555-0100,example.ca,https://example.ca/listing';
  const parsed = parseCitationCsv(csv);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].directory, "Directory, Inc.");
  assert.equal(parsed.rows[0].name, 'Cafe "Montréal"');
  assert.match(parsed.rows[0].address, /\nMontréal/);
});

test("rejects missing required headers and oversized inputs", () => {
  assert.throws(() => parseCitationCsv("value\nhello"), /directory column/);
  assert.throws(() => parseCitationCsv("a".repeat(250001)), /too large/);
  assert.throws(() => parseCitationCsv('directory,name\n"not closed'), /Unclosed quote/);
});

test("flags mismatch, missing evidence and duplicate supplied citation, never live verification", () => {
  const result = auditCitations(reference, [
    row,
    { ...row, phone: "514-555-9999", listingUrl: "https://directory.example/different" },
    { ...row, phone: "", listingUrl: "https://directory.example/missing" },
    row,
  ]);
  assert.deepEqual(result.summary, { total: 4, consistent: 2, needsUpdate: 1, needsVerification: 1, duplicates: 1 });
  assert.equal(result.findings[1].fields.phone, "mismatch");
  assert.equal(result.findings[2].fields.phone, "missing_in_citation");
  assert.equal(result.findings[3].duplicate, true);
});

test("ignores unsafe citation URL protocols", () => {
  const parsed = parseCitationCsv("directory,name,listing_url\nTest,Business,javascript:alert(1)");
  assert.equal(parsed.rows[0].listingUrl, "");
  assert.equal(parsed.warnings.length, 1);
});

test("escapes spreadsheet-formula injection when exporting audit", () => {
  const findings = auditCitations(reference, [{ ...row, directory: "=HYPERLINK(1)", name: "+1+1" }]).findings;
  const exported = exportCitationAuditCsv(findings);
  assert.ok(exported.includes("\"'=HYPERLINK(1)\""));
  assert.ok(exported.includes("\"'+1+1\""));
  assert.ok(exported.startsWith("\uFEFF"));
});
