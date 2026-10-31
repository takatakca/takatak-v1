import { observedSource, reviewSource } from "./sources";

export type ReviewOrigin = "feedback" | "external" | "listing";
export type ReviewRecord = {
  key: string;
  id: string;
  origin: ReviewOrigin;
  source: string;
  author: string;
  location: string;
  rating: number | null;
  text: string;
  createdAt: string;
  response: string | null;
  state: "needs_reply" | "answered" | "follow_up" | "resolved" | "tracked";
  recommended: boolean;
  sample: boolean;
  canDraft: boolean;
  qmapsReviewId: string | null;
};
export type FeedbackRow = {
  id: string;
  rating: number;
  feedback: string | null;
  contactName: string | null;
  status: string;
  createdAt: Date;
  profile: { name: string };
};
export type ExternalRow = {
  id: string;
  source: string;
  reviewerName: string | null;
  rating: number;
  comment: string | null;
  externalCreateAt: Date;
  replyComment: string | null;
  location: { title: string };
};
export type ListingRow = {
  id: string;
  provider: string;
  reviewerName: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  status: string;
  replyStatus: string;
  reviewedAt: Date | null;
  createdAt: Date;
  metadata: unknown;
  localListing: { name: string } | null;
};
export type CockpitReaders = {
  feedback: (clientId: string, take: number) => Promise<FeedbackRow[]>;
  external: (clientId: string, take: number) => Promise<ExternalRow[]>;
  listing: (clientId: string, take: number) => Promise<ListingRow[]>;
};
export type CockpitSnapshot = {
  records: ReviewRecord[];
  unavailable: ReviewOrigin[];
  truncated: ReviewOrigin[];
  limitPerSource: number;
};
const LIMIT = 200;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const rating = (value: number | null): number | null =>
  value !== null && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null;
const safeText = (value: unknown, max = 10000): string =>
  typeof value === "string" ? value.slice(0, max) : "";

export function normalizeFeedback(row: FeedbackRow): ReviewRecord {
  return {
    key: `feedback:${row.id}`,
    id: row.id,
    origin: "feedback",
    source: "takatak",
    author: row.contactName || "Customer",
    location: row.profile.name,
    rating: rating(row.rating),
    text: row.feedback || "",
    createdAt: row.createdAt.toISOString(),
    response: null,
    state: row.status === "resolved" ? "resolved" : "follow_up",
    recommended: true,
    sample: false,
    canDraft: !!row.feedback,
    qmapsReviewId: null,
  };
}
export function normalizeExternal(row: ExternalRow): ReviewRecord {
  const source = observedSource(row.source);
  return {
    key: `external:${row.id}`,
    id: row.id,
    origin: "external",
    source,
    author: row.reviewerName || "Customer",
    location: row.location.title,
    rating:
      reviewSource(source)?.kind === "recommendations" ||
      reviewSource(source)?.kind === "social"
        ? null
        : rating(row.rating),
    text: row.comment || "",
    createdAt: row.externalCreateAt.toISOString(),
    response: row.replyComment,
    state: row.replyComment?.trim()
      ? "answered"
      : source === "google"
        ? "needs_reply"
        : "tracked",
    recommended: true,
    sample: false,
    canDraft: source === "google" && !!row.comment,
    qmapsReviewId: null,
  };
}
export function normalizeListing(row: ListingRow): ReviewRecord {
  const meta = record(row.metadata);
  // future_provider needs explicit provider provenance; never guess from body text.
  const source = observedSource(
    row.provider === "future_provider"
      ? safeText(meta.reputationProvider, 40)
      : row.provider,
  );
  const qmapsId =
    source === "qmaps" &&
    meta.source === "qmaps" &&
    typeof meta.qmapsReviewId === "string" &&
    uuid.test(meta.qmapsReviewId)
      ? meta.qmapsReviewId
      : null;
  const sample =
    row.provider === "internal_demo" ||
    row.status === "internal_demo" ||
    row.status === "planned";
  const confirmed =
    source === "qmaps"
      ? meta.replyState === "sent_to_qmaps"
      : meta.providerReplyConfirmed === true;
  const response = confirmed ? safeText(meta.replyText, 5000) || null : null;
  const rawRating =
    reviewSource(source)?.kind === "recommendations" ||
    reviewSource(source)?.kind === "social"
      ? null
      : rating(row.rating);
  return {
    key: `listing:${row.id}`,
    id: row.id,
    origin: "listing",
    source,
    author: row.reviewerName || "Customer",
    location: row.localListing?.name || "Unlinked record",
    rating: rawRating,
    text: row.body || row.title || "",
    createdAt: (row.reviewedAt || row.createdAt).toISOString(),
    response,
    state: confirmed
      ? "answered"
      : source === "qmaps" && qmapsId
        ? "needs_reply"
        : "tracked",
    recommended: meta.recommended !== false,
    sample,
    canDraft: false,
    qmapsReviewId: qmapsId,
  };
}

export async function readCockpit(
  clientId: string,
  readers: CockpitReaders,
): Promise<CockpitSnapshot> {
  if (!uuid.test(clientId)) throw new Error("invalid_workspace");
  const origins: ReviewOrigin[] = ["feedback", "external", "listing"];
  const results = await Promise.allSettled([
    readers.feedback(clientId, LIMIT + 1),
    readers.external(clientId, LIMIT + 1),
    readers.listing(clientId, LIMIT + 1),
  ]);
  const records: ReviewRecord[] = [];
  const unavailable: ReviewOrigin[] = [];
  const truncated: ReviewOrigin[] = [];
  results.forEach((result, i) => {
    const origin = origins[i];
    if (result.status === "rejected") {
      unavailable.push(origin);
      return;
    }
    if (result.value.length > LIMIT) truncated.push(origin);
    for (const raw of result.value.slice(0, LIMIT)) {
      const normalized =
        origin === "feedback"
          ? normalizeFeedback(raw as FeedbackRow)
          : origin === "external"
            ? normalizeExternal(raw as ExternalRow)
            : normalizeListing(raw as ListingRow);
      if (!normalized.sample) records.push(normalized);
    }
  });
  // Stable database identity only. Similar prose or equal scores never merge people.
  const unique = [...new Map(records.map((r) => [r.key, r])).values()];
  unique.sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || a.key.localeCompare(b.key),
  );
  return { records: unique, unavailable, truncated, limitPerSource: LIMIT };
}
export function cockpitStats(records: ReviewRecord[]) {
  const included = records.filter((r) => r.recommended && !r.sample);
  const rated = included.filter(
    (r): r is ReviewRecord & { rating: number } => r.rating !== null,
  );
  const replyable = included.filter(
    (r) => r.state === "needs_reply" || r.state === "answered",
  );
  return {
    total: included.length,
    rated: rated.length,
    average: rated.length
      ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length
      : null,
    unanswered: replyable.filter((r) => r.state === "needs_reply").length,
    responseRate: replyable.length
      ? Math.round(
          (100 * replyable.filter((r) => r.state === "answered").length) /
            replyable.length,
        )
      : null,
    lowRatings: rated.filter((r) => r.rating <= 3).length,
    distribution: [5, 4, 3, 2, 1].map((value) => ({
      rating: value,
      count: rated.filter((r) => r.rating === value).length,
    })),
  };
}
export function filterCockpit(
  records: ReviewRecord[],
  input: {
    source?: string;
    query?: string;
    state?: string;
    rating?: number | null;
    days?: number | null;
  },
  now = Date.now(),
) {
  const query = (input.query || "").toLowerCase().trim();
  return records.filter(
    (r) =>
      (!input.source || input.source === "all" || r.source === input.source) &&
      (!query ||
        `${r.author} ${r.text} ${r.location}`.toLowerCase().includes(query)) &&
      (!input.state || input.state === "all" || r.state === input.state) &&
      (!input.rating || r.rating === input.rating) &&
      (!input.days ||
        new Date(r.createdAt).getTime() >= now - input.days * 86400000),
  );
}
export function cockpitCSV(records: ReviewRecord[]): string {
  const cell = (value: unknown) =>
    '"' +
    String(value ?? "")
      .replace(/^[\s]*[=+\-@\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [
    [
      "source",
      "author",
      "location",
      "rating",
      "text",
      "response",
      "state",
      "received",
    ],
    ...records.map((r) => [
      r.source,
      r.author,
      r.location,
      r.rating,
      r.text,
      r.response,
      r.state,
      r.createdAt,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
