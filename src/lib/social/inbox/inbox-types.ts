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
};

export type InboxPageData = {
  connectedPlatforms: string[];
  attentionPlatforms: string[];
  threads: InboxThread[];
};
