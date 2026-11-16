import assert from "node:assert/strict";
import test from "node:test";
import {
  auditCitations, compareNapField, exportCitationAuditCsv, parseCitationCsv,
} from "../src/lib/local-listings/citation-audit.ts";

const reference = {
  name: "Café Montréal", address: "123 Rue Saint-Paul, Montréal, QC",
  phone: "+1 (514) 555-0100", website: "https://www.example.ca/",
};
const row = {
  directory: "Example Directory", listingUrl: "https://directory.example/cafe",
  name: "Cafe Montreal", address: "123 Rue Saint Paul, Montreal, QC",
  phone: "514-555-0100", website: "example.ca",
};

test("normalizes accents, punctuation, North American phones and website scheme", () => {
  for (const field of ["name", "address", "phone", "website"]) {
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


import {
  citationEvidenceMatchesProfile, readObservedCitationNap,
  readGoogleSnapshotAddress, readGoogleSnapshotPhone, rowsForSavedEvidence,
  safeCitationLink,
} from "../src/lib/local-listings/citation-evidence.ts";
import { getGoogleBusinessPrimaryPhone } from "../src/lib/social/providers/google-business-contact.ts";

const linkedProfile = {
  id: "local:location-a", label: "Business A", source: "local_listing",
  observedAt: null, businessBrandId: "brand-a", localListingId: "location-a",
  socialAccountId: null, nap: reference,
};

const linkedGoogle = {
  id: "google:google-a", source: "google_business_snapshot",
  sourceLabel: "Google snapshot", observedAt: null,
  businessBrandId: "brand-a", localListingId: null,
  socialAccountId: "google-a", row,
};

test("only explicit observedNap metadata counts as directory observation", () => {
  assert.deepEqual(readObservedCitationNap({ name: "Unverified company", phone: "99999" }), {
    name: "", address: "", phone: "", website: "",
  });
  assert.deepEqual(readObservedCitationNap({ observedNap: { name: "Recorded", phone: "+1 514 555 0100" } }), {
    name: "Recorded", address: "", phone: "+1 514 555 0100", website: "",
  });
  assert.deepEqual(readObservedCitationNap([]), { name: "", address: "", phone: "", website: "" });
});

test("stored Google snapshots use readMask primary phone and saved address only", () => {
  assert.equal(getGoogleBusinessPrimaryPhone({ primaryPhone: " +1 514 555 0100 " }), "+1 514 555 0100");
  assert.equal(getGoogleBusinessPrimaryPhone({ additionalPhones: ["123"] }), null);
  assert.equal(getGoogleBusinessPrimaryPhone({ primaryPhone: 45 }), null);
  assert.equal(readGoogleSnapshotPhone({ primaryPhone: "514-555-0100" }), "514-555-0100");
  assert.equal(readGoogleSnapshotPhone({}), "");
  assert.equal(readGoogleSnapshotAddress({
    addressLines: ["123 Rue Saint-Paul"], locality: "Montréal",
    administrativeArea: "QC", postalCode: "H2Y 1G2",
  }), "123 Rue Saint-Paul, Montréal, QC, H2Y 1G2");
});

test("saved evidence never implicitly matches another location under same brand", () => {
  assert.equal(citationEvidenceMatchesProfile(linkedProfile, {
    ...linkedGoogle, localListingId: "location-b", socialAccountId: null,
  }), false);
  assert.equal(citationEvidenceMatchesProfile(linkedProfile, {
    ...linkedGoogle, localListingId: "location-a", socialAccountId: null,
  }), true);
  assert.equal(citationEvidenceMatchesProfile(linkedProfile, linkedGoogle), false);
  assert.equal(citationEvidenceMatchesProfile(linkedProfile, {
    ...linkedGoogle, businessBrandId: "brand-b", localListingId: null, socialAccountId: null,
  }), false);
  assert.equal(citationEvidenceMatchesProfile(linkedProfile, {
    ...linkedGoogle, businessBrandId: "brand-a", localListingId: null, socialAccountId: null,
  }), false);
  assert.deepEqual(rowsForSavedEvidence(linkedProfile, [linkedGoogle]), []);
  assert.deepEqual(rowsForSavedEvidence(undefined, [linkedGoogle]), []);
});

test("only valid remote listing URLs are rendered as links", () => {
  assert.equal(safeCitationLink("javascript:alert(1)"), "");
  assert.equal(safeCitationLink("https://user:pass@example.com/profile"), "");
  assert.equal(safeCitationLink("https://directory.example/profile"), "https://directory.example/profile");
});


import { buildCitationProfileChoices } from "../src/lib/local-listings/citation-profile-choices.ts";

test("same-name saved profiles remain distinct by source, address and stable record reference", () => {
  const profiles = [
    {
      id: "local:11111111-aaaa-aaaa-aaaa-000000000001",
      label: "Club Havana Camping — saved TAKATAK listing",
      source: "local_listing", nap: {
        name: "Club Havana Camping", address: "100 Rue A, Montréal",
        phone: "", website: "",
      },
    },
    {
      id: "google:22222222-bbbb-bbbb-bbbb-000000000002",
      label: "Club Havana Camping — connected Google snapshot",
      source: "google_business_connection", nap: {
        name: "club havana camping", address: "200 Rue B, Laval",
        phone: "", website: "",
      },
    },
  ];
  const snapshot = JSON.stringify(profiles);
  const choices = buildCitationProfileChoices(profiles);
  assert.equal(choices.length, 2);
  assert.ok(choices.every(choice => choice.sharesName));
  assert.notEqual(choices[0].id, choices[1].id);
  assert.notEqual(choices[0].label, choices[1].label);
  assert.match(choices[0].label, /TAKATAK listing.*Montréal.*000001/);
  assert.match(choices[1].label, /Google snapshot.*Laval.*000002/);
  assert.equal(JSON.stringify(profiles), snapshot, "must not edit source records");
});

test("accents and punctuation normalize when identifying ambiguous names", () => {
  const base = {
    id: "local:a", label: "Café Montréal",
    source: "local_listing", nap: {
      name: "Café-Montréal", address: "", phone: "", website: "",
    },
  };
  const profileList = [
    base, { ...base, id: "local:b", nap: { ...base.nap, name: "cafe montreal" } },
  ];
  const choices = buildCitationProfileChoices(profileList);
  assert.ok(choices.every(choice => choice.sharesName));
  assert.ok(choices[0].label.includes("address not stored"));
});

test("unique business names and empty names are not falsely flagged", () => {
  const base = { id: "local:a", label: "Business A",
    source: "local_listing", nap: {
      name: "Business A", address: "", phone: "", website: "",
    },
  };
  const items = [
    base, { ...base, id: "google:b", label: "Business B", nap: { ...base.nap, name: "Business B" } },
    { ...base, id: "local:c", label: "Unnamed 1", nap: { ...base.nap, name: "" } },
    { ...base, id: "local:d", label: "Unnamed 2", nap: { ...base.nap, name: "  " } },
  ];
  const choices = buildCitationProfileChoices(items);
  assert.ok(choices.every(choice => !choice.sharesName));
  assert.deepEqual(choices.map(choice => choice.label), items.map(item => item.label));
});
