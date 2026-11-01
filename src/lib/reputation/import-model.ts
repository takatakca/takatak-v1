export const MAX_REVIEW_IMPORT_ROWS = 50;

// These are source identifiers and permitted evidence-link hosts, not claims of
// API access, licensed redistribution rights, or source verification. Never fetch
// a user-supplied evidence URL from this import path.
export const REVIEW_IMPORT_HOSTS: Readonly<Record<string, readonly string[]>> =
  {
    google: [
      "google.com",
      "www.google.com",
      "maps.google.com",
      "search.google.com",
      "g.page",
    ],
    facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
    yelp: ["yelp.ca", "www.yelp.ca", "yelp.com", "www.yelp.com"],
    tripadvisor: [
      "tripadvisor.ca",
      "www.tripadvisor.ca",
      "tripadvisor.com",
      "www.tripadvisor.com",
    ],
    trustpilot: ["trustpilot.com", "www.trustpilot.com", "ca.trustpilot.com"],
    qmaps: ["qmaps.ca", "www.qmaps.ca"],
    flexs: ["flexs.ca", "www.flexs.ca"],
    booking: ["booking.com", "www.booking.com"],
  };

export const IMPORTABLE_REVIEW_SOURCES = Object.keys(REVIEW_IMPORT_HOSTS);

export type ReviewImportRow = {
  source: string;
  externalId: string;
  author: string | null;
  text: string;
  rating: number | null;
  reviewedAt: string;
  url: string | null;
};
export type ReviewImportResult =
  | {
      ok: true;
      rows: ReviewImportRow[];
      listingId: string;
      provenance: "manual" | "email" | "csv";
    }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const forbiddenControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const rootKeys = new Set(["listingId", "provenance", "rows"]);
const rowKeys = new Set([
  "source",
  "externalId",
  "author",
  "text",
  "rating",
  "reviewedAt",
  "url",
]);
const object = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const sourceExists = (source: string) =>
  Object.hasOwn(REVIEW_IMPORT_HOSTS, source);
const permittedKeys = (value: Record<string, unknown>, allowed: Set<string>) =>
  Reflect.ownKeys(value).every(
    (key) => typeof key === "string" && allowed.has(key),
  );
const boundedText = (value: unknown, max: number) =>
  typeof value === "string" &&
  value.length <= max &&
  !forbiddenControls.test(value);
const fail = (error: string): ReviewImportResult => ({ ok: false, error });

// Date.parse alone accepts impossible calendar dates by rolling into the next
// month. Validate every component before converting a timezone-qualified date.
function importDate(value: unknown, now: number): string | null {
  if (typeof value !== "string") return null;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parts) return null;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    zone,
  ] = parts;
  const year = Number(yearText),
    month = Number(monthText),
    day = Number(dayText);
  const hour = Number(hourText),
    minute = Number(minuteText),
    second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > monthDays[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  if (zone !== "Z") {
    const offsetHours = Number(zone.slice(1, 3)),
      offsetMinutes = Number(zone.slice(4, 6));
    if (
      offsetHours > 14 ||
      offsetMinutes > 59 ||
      (offsetHours === 14 && offsetMinutes !== 0)
    )
      return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now + 86400000
    ? new Date(timestamp).toISOString()
    : null;
}

export function reviewEvidenceURL(
  value: unknown,
  source: string,
): string | null | false {
  if (value === undefined || value === null || value === "") return null;
  if (!boundedText(value, 2048) || (value as string).trim() !== value)
    return false;
  // URL normalizes an explicit :443 away. Reject every explicit port, including
  // :443, before parsing, as well as control characters/whitespace URL ignores.
  const text = value as string;
  if (!/^https:\/\/[^\s/?#]+(?:[/?#]|$)/.test(text)) return false;
  if (/\s/.test(text)) return false;
  const authority = text.slice(8).split(/[/?#]/, 1)[0];
  if (authority.includes(":") || authority.includes("@") || text.includes("\\"))
    return false;
  try {
    const url = new URL(text);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !REVIEW_IMPORT_HOSTS[source].includes(url.hostname)
    )
      return false;
    return url.href;
  } catch {
    return false;
  }
}

/** Parse extracted, owner-reviewed review fields; never an entire mailbox. */
export function parseReviewImport(input: unknown): ReviewImportResult {
  if (!object(input) || !permittedKeys(input, rootKeys))
    return fail("Import must contain only listingId, provenance and rows.");
  if (typeof input.listingId !== "string" || !UUID.test(input.listingId))
    return fail("Choose a valid business listing.");
  if (
    typeof input.provenance !== "string" ||
    !["manual", "email", "csv"].includes(input.provenance)
  )
    return fail("Choose manual, email or csv import provenance.");
  if (
    !Array.isArray(input.rows) ||
    input.rows.length < 1 ||
    input.rows.length > MAX_REVIEW_IMPORT_ROWS
  )
    return fail(
      `Import between 1 and ${MAX_REVIEW_IMPORT_ROWS} reviews at a time.`,
    );
  const rows: ReviewImportRow[] = [];
  const identities = new Set<string>();
  const now = Date.now();
  for (let index = 0; index < input.rows.length; index++) {
    const item: unknown = input.rows[index];
    const prefix = `Review ${index + 1}: `;
    if (!object(item) || !permittedKeys(item, rowKeys))
      return fail(prefix + "contains unsupported fields.");
    if (typeof item.source !== "string" || !sourceExists(item.source))
      return fail(prefix + "choose a supported review source.");
    if (
      !boundedText(item.externalId, 256) ||
      !(item.externalId as string).trim()
    )
      return fail(
        prefix + "provide a source review identifier of 1–256 characters.",
      );
    if (!boundedText(item.text, 5000) || !(item.text as string).trim())
      return fail(prefix + "provide review text of 1–5000 characters.");
    if (
      item.author !== undefined &&
      item.author !== null &&
      !boundedText(item.author, 120)
    )
      return fail(prefix + "author must be at most 120 characters.");
    const rating =
      item.rating === undefined || item.rating === null ? null : item.rating;
    if (
      rating !== null &&
      (typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5)
    )
      return fail(
        prefix + "rating must be a whole number from 1 to 5, or omitted.",
      );
    if (item.source === "facebook" && rating !== null)
      return fail(
        prefix + "Facebook recommendations cannot be imported as star ratings.",
      );
    const reviewedAt = importDate(item.reviewedAt, now);
    if (!reviewedAt)
      return fail(
        prefix +
          "provide a real timezone-qualified ISO date, no more than 24 hours ahead.",
      );
    const url = reviewEvidenceURL(item.url, item.source);
    if (url === false)
      return fail(
        prefix +
          "evidence URL must use HTTPS on that source's approved host, without credentials or a port.",
      );
    const externalId = (item.externalId as string).trim();
    const identity = JSON.stringify([item.source, externalId]);
    if (identities.has(identity))
      return fail(
        prefix + "duplicates a source review identifier in this import.",
      );
    identities.add(identity);
    rows.push({
      source: item.source,
      externalId,
      author:
        typeof item.author === "string" ? item.author.trim() || null : null,
      text: (item.text as string).trim(),
      rating,
      reviewedAt,
      url,
    });
  }
  if (
    new TextEncoder().encode(
      JSON.stringify({
        listingId: input.listingId,
        provenance: input.provenance,
        rows,
      }),
    ).byteLength >
    128 * 1024
  )
    return fail(
      "Normalized import must be at most 128 KiB; split this batch before previewing.",
    );
  return {
    ok: true,
    rows,
    listingId: input.listingId.toLowerCase(),
    provenance: input.provenance as "manual" | "email" | "csv",
  };
}

export type ReviewCSVResult =
  { ok: true; rows: unknown[] } | { ok: false; error: string };

/** Small bounded RFC-style CSV reader. Values are data, never executable formulas. */
export function parseReviewCSV(text: string): ReviewCSVResult {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).byteLength > 128 * 1024
  )
    return { ok: false, error: "CSV must be at most 128 KiB." };
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  const records: string[][] = [];
  let cells: string[] = [],
    cell = "",
    state: "plain" | "quoted" | "closed" = "plain";
  const finishCell = () => {
    cells.push(cell);
    cell = "";
    state = "plain";
  };
  const finishRecord = () => {
    finishCell();
    records.push(cells);
    cells = [];
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (state === "quoted") {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else state = "closed";
      } else cell += char;
      continue;
    }
    if (char === ",") {
      finishCell();
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      finishRecord();
      if (records.length > MAX_REVIEW_IMPORT_ROWS + 1)
        return {
          ok: false,
          error: `CSV must contain at most ${MAX_REVIEW_IMPORT_ROWS} reviews.`,
        };
      continue;
    }
    if (state === "closed")
      return {
        ok: false,
        error: "CSV has unexpected text after a closing quote.",
      };
    if (char === '"') {
      if (cell.length)
        return {
          ok: false,
          error: "CSV quotes must surround an entire field.",
        };
      state = "quoted";
    } else cell += char;
  }
  if (state === "quoted")
    return { ok: false, error: "CSV contains an unclosed quoted field." };
  if (cell.length || cells.length || state === "closed") finishRecord();
  if (records.length < 2 || records.length > MAX_REVIEW_IMPORT_ROWS + 1)
    return {
      ok: false,
      error: `CSV must contain a header and 1–${MAX_REVIEW_IMPORT_ROWS} review rows.`,
    };
  const headers = records[0].map((header) => header.trim());
  if (
    new Set(headers).size !== headers.length ||
    headers.some((header) => !rowKeys.has(header)) ||
    ["source", "externalId", "text", "reviewedAt"].some(
      (header) => !headers.includes(header),
    )
  )
    return {
      ok: false,
      error:
        "CSV needs unique source, externalId, text and reviewedAt headers; optional headers are author, rating and url.",
    };
  const rows: unknown[] = [];
  for (let index = 1; index < records.length; index++) {
    if (records[index].length !== headers.length)
      return {
        ok: false,
        error: `CSV row ${index + 1} has a different number of fields than the header.`,
      };
    const row: Record<string, unknown> = {};
    headers.forEach((header, column) => {
      const value = records[index][column];
      row[header] =
        header === "rating"
          ? value.trim()
            ? Number(value.trim())
            : null
          : value;
    });
    rows.push(row);
  }
  return { ok: true, rows };
}
