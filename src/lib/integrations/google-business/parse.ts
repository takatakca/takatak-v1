// Google Business Profile — pure parsers (accounts, locations, reviews).

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export interface GbpAccount {
  name: string; // accounts/{id}
  accountName: string | null;
}

export interface GbpLocation {
  resourceName: string; // accounts/{a}/locations/{l} — the v4 reviews parent
  title: string;
  address: string | null;
}

export interface GbpReview {
  externalId: string;
  reviewerName: string | null;
  rating: number;
  comment: string | null;
  createTime: Date;
  updateTime: Date;
  replyComment: string | null;
  replyUpdatedAt: Date | null;
}

export function parseAccounts(raw: unknown): GbpAccount[] {
  const list = (raw as { accounts?: Array<{ name?: unknown; accountName?: unknown }> })?.accounts ?? [];
  return list
    .filter((a) => typeof a.name === "string" && /^accounts\/[0-9]+$/.test(a.name))
    .map((a) => ({ name: a.name as string, accountName: typeof a.accountName === "string" ? a.accountName : null }));
}

/** Business Information API returns "locations/{id}"; v4 reviews need "accounts/{a}/locations/{l}". */
export function parseLocations(raw: unknown, accountName: string): GbpLocation[] {
  const list =
    (raw as {
      locations?: Array<{
        name?: unknown;
        title?: unknown;
        storefrontAddress?: { addressLines?: unknown; locality?: unknown; postalCode?: unknown };
      }>;
    })?.locations ?? [];
  const out: GbpLocation[] = [];
  for (const loc of list) {
    const id = typeof loc.name === "string" ? /^locations\/([0-9]+)$/.exec(loc.name)?.[1] : undefined;
    if (!id) continue;
    const lines = Array.isArray(loc.storefrontAddress?.addressLines) ? (loc.storefrontAddress!.addressLines as unknown[]).filter((x) => typeof x === "string") : [];
    const parts = [...lines, loc.storefrontAddress?.locality, loc.storefrontAddress?.postalCode].filter((x): x is string => typeof x === "string" && Boolean(x));
    out.push({
      resourceName: `${accountName}/locations/${id}`,
      title: typeof loc.title === "string" && loc.title.trim() ? loc.title.trim().slice(0, 200) : `Location ${id}`,
      address: parts.length ? parts.join(", ").slice(0, 300) : null,
    });
  }
  return out;
}

export function parseReviewsPage(raw: unknown): { reviews: GbpReview[]; nextPageToken: string | null } {
  const data = raw as {
    reviews?: Array<{
      reviewId?: unknown;
      reviewer?: { displayName?: unknown };
      starRating?: unknown;
      comment?: unknown;
      createTime?: unknown;
      updateTime?: unknown;
      reviewReply?: { comment?: unknown; updateTime?: unknown };
    }>;
    nextPageToken?: unknown;
  };
  const reviews: GbpReview[] = [];
  for (const r of data?.reviews ?? []) {
    const rating = typeof r.starRating === "string" ? STARS[r.starRating] : undefined;
    const created = typeof r.createTime === "string" ? new Date(r.createTime) : null;
    if (typeof r.reviewId !== "string" || !r.reviewId || !rating || !created || Number.isNaN(created.getTime())) continue;
    const updated = typeof r.updateTime === "string" && !Number.isNaN(Date.parse(r.updateTime)) ? new Date(r.updateTime) : created;
    const replyAt = typeof r.reviewReply?.updateTime === "string" && !Number.isNaN(Date.parse(r.reviewReply.updateTime)) ? new Date(r.reviewReply.updateTime) : null;
    reviews.push({
      externalId: r.reviewId.slice(0, 300),
      reviewerName: typeof r.reviewer?.displayName === "string" ? r.reviewer.displayName.slice(0, 120) : null,
      rating,
      comment: typeof r.comment === "string" && r.comment.trim() ? r.comment.slice(0, 5000) : null,
      createTime: created,
      updateTime: updated,
      replyComment: typeof r.reviewReply?.comment === "string" ? r.reviewReply.comment.slice(0, 5000) : null,
      replyUpdatedAt: replyAt,
    });
  }
  return { reviews, nextPageToken: typeof data?.nextPageToken === "string" && data.nextPageToken ? data.nextPageToken : null };
}
