export type InboxKind = "private" | "comment" | "review";

export type InboxThread = {
  id: string;
  senderName: string;
  senderImageUrl: string | null;
  platform: string;
  kind: InboxKind;
  preview: string;
  body: string;
  occurredAt: string;
  unread: boolean;
  unresolved: boolean;
  /** Reviews only: star rating (1–5), the published reply, and where to answer it. */
  rating?: number | null;
  reply?: string | null;
  locationTitle?: string | null;
  replyHref?: string | null;
};

export type InboxPageData = {
  connectedPlatforms: string[];
  attentionPlatforms: string[];
  threads: InboxThread[];
};
