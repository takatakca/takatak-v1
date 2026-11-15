/**
 * Browser-local evidence audit, NOT an automatic directory scan.
 * No external requests or customer content is sent to TAKATAK servers.
 */
export type NapField = "name" | "address" | "phone" | "website";
export type BusinessNap = Record<NapField, string>;
export type CitationRow = BusinessNap & { directory: string; listingUrl: string };
export type CitationReferenceProfile = {
  id: string;
  label: string;
  source: "google_business_connection" | "local_listing";
  observedAt: string | null;
  nap: BusinessNap;
};
export type FieldFinding = "match" | "mismatch" | "missing_in_citation" | "reference_missing";
export type AuditStatus = "needs_update" | "needs_verification" | "consistent_in_supplied_data";
export type CitationFinding = CitationRow & {
  fields: Record<NapField, FieldFinding>;
  status: AuditStatus;
  duplicate: boolean;
};
export type AuditSummary = {
  total: number;
  consistent: number;
  needsUpdate: number;
  needsVerification: number;
  duplicates: number;
};
export type ParsedCitations = { rows: CitationRow[]; warnings: string[] };

const FIELDS: NapField[] = ["name", "address", "phone", "website"];
const HEADERS: Record<string, keyof CitationRow> = {
  directory: "directory", source: "directory", platform: "directory",
  businessname: "name", name: "name", listingname: "name",
  address: "address", streetaddress: "address",
  phone: "phone", telephone: "phone", phonenumber: "phone",
  website: "website", businesswebsite: "website",
  listingurl: "listingUrl", citationurl: "listingUrl", profileurl: "listingUrl",
};

function canonicalText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function canonicalPhone(value: string): string {
  let number = value.replace(/\D/g, "");
  if (number.length === 11 && number.startsWith("1")) number = number.slice(1);
  return number;
}

function canonicalWebsite(value: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
    if (!["https:", "http:"].includes(u.protocol)) return canonicalText(value);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return host + path;
  } catch {
    return canonicalText(value);
  }
}

export function compareNapField(field: NapField, expected: string, observed: string): FieldFinding {
  if (!expected.trim()) return "reference_missing";
  if (!observed.trim()) return "missing_in_citation";
  const canonical = field === "phone" ? canonicalPhone : field === "website" ? canonicalWebsite : canonicalText;
  return canonical(expected) === canonical(observed) ? "match" : "mismatch";
}

/** Supports RFC-style quoted fields, embedded line breaks, commas and escaped quotes. */
function splitCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell.length === 0) quoted = !quoted;
      else cell += ch;
    } else if (ch === "," && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(x => x.length)) rows.push(row);
      row = []; cell = "";
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  row.push(cell.trim());
  if (row.some(x => x.length)) rows.push(row);
  return rows;
}

export function parseCitationCsv(csv: string): ParsedCitations {
  if (csv.length > 250_000) throw new Error("File is too large (250 KB maximum).");
  const lines = splitCsv(csv.replace(/^\uFEFF/, ""));
  if (lines.length === 0) return { rows: [], warnings: [] };
  const mapped = lines[0].map(h => HEADERS[h.toLowerCase().replace(/[^a-z]/g, "")] ?? null);
  if (!mapped.includes("directory") || !mapped.some(h => FIELDS.includes(h as NapField))) {
    throw new Error("CSV must include a directory column and at least one of: name, address, phone, website.");
  }
  if (lines.length > 501) throw new Error("Maximum 500 citation rows per audit.");
  const rows: CitationRow[] = [];
  const warnings: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    const record: CitationRow = { directory: "", name: "", address: "", phone: "", website: "", listingUrl: "" };
    mapped.forEach((header, idx) => { if (header) record[header] = cells[idx] ?? ""; });
    if (!record.directory) { warnings.push("Row " + (i + 1) + " skipped: directory missing."); continue; }
    if (record.listingUrl) {
      try {
        const url = new URL(record.listingUrl);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid");
      } catch { warnings.push("Row " + (i + 1) + ": listing URL is not a valid HTTP(S) link."); record.listingUrl = ""; }
    }
    rows.push(record);
  }
  return { rows, warnings };
}

export function auditCitations(reference: BusinessNap, rows: CitationRow[]): { findings: CitationFinding[]; summary: AuditSummary } {
  const seen = new Set<string>();
  const findings = rows.map(row => {
    const fields = {} as Record<NapField, FieldFinding>;
    for (const field of FIELDS) fields[field] = compareNapField(field, reference[field], row[field]);
    const key = canonicalText(row.directory) + "|" + (row.listingUrl ? canonicalWebsite(row.listingUrl) : canonicalText(row.name + " " + row.address));
    const duplicate = seen.has(key);
    seen.add(key);
    const checks = Object.values(fields);
    const status: AuditStatus = checks.includes("mismatch") ? "needs_update"
      : checks.some(c => c !== "match") ? "needs_verification" : "consistent_in_supplied_data";
    return { ...row, fields, status, duplicate };
  });
  return {
    findings,
    summary: {
      total: findings.length,
      consistent: findings.filter(f => f.status === "consistent_in_supplied_data").length,
      needsUpdate: findings.filter(f => f.status === "needs_update").length,
      needsVerification: findings.filter(f => f.status === "needs_verification").length,
      duplicates: findings.filter(f => f.duplicate).length,
    },
  };
}

function quoteCsv(value: string): string {
  // Prevent spreadsheet formula injection when a customer opens an exported CSV.
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function exportCitationAuditCsv(findings: CitationFinding[]): string {
  const headers = ["directory", "listing_url", "status", "duplicate", ...FIELDS, ...FIELDS.map(f => f + "_check")];
  const output = [headers.map(quoteCsv).join(",")];
  for (const item of findings) {
    output.push([item.directory, item.listingUrl, item.status, String(item.duplicate),
      ...FIELDS.map(f => item[f]), ...FIELDS.map(f => item.fields[f])].map(quoteCsv).join(","));
  }
  return "\uFEFF" + output.join("\r\n");
}
