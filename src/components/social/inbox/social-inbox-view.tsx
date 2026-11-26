"use client";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import {
  Check,
  Filter,
  Mail,
  MessageCircleWarning,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import type {
  InboxKind,
  InboxPageData,
  InboxThread,
} from "@/lib/social/inbox/inbox-types";

const INBOX_PLATFORMS: SocialPlatformKey[] = [
  "facebook",
  "instagram",
  "google_business",
  "youtube",
];

const KIND_PLATFORMS: Record<InboxKind, SocialPlatformKey[]> = {
  private: ["facebook", "instagram"],
  comment: ["facebook", "instagram", "youtube"],
  review: ["google_business"],
};

function isPlatformKey(value: string): value is SocialPlatformKey {
  return INBOX_PLATFORMS.includes(value as SocialPlatformKey);
}

function formatThreadTime(value: string, fr = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(fr ? "fr-CA" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SocialInboxView({ data }: { data: InboxPageData }) {
  const fr = useDashboardLanguage() === "fr";
  const searchParams = useSearchParams();
  const connectionsHref = withSocialPreview(
    "/dashboard/social/inbox?connections=open",
    searchParams,
  );

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"unresolved" | "unread" | "all">(
    "unresolved",
  );
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<InboxKind | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const connected = new Set(
    data.connectedPlatforms.map((platform) => platform.toLowerCase()),
  );
  const attention = new Set(
    data.attentionPlatforms.map((platform) => platform.toLowerCase()),
  );

  const unreadCount = data.threads.filter((thread) => thread.unread).length;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const searchReady = needle.length >= 3;

    return data.threads.filter((thread) => {
      if (tab === "unresolved" && !thread.unresolved) {
        return false;
      }
      if (tab === "unread" && !thread.unread) {
        return false;
      }
      if (
        platformFilter !== "all" &&
        thread.platform.toLowerCase() !== platformFilter
      ) {
        return false;
      }
      if (kindFilter !== "all" && thread.kind !== kindFilter) {
        return false;
      }
      if (searchReady) {
        const haystack =
          `${thread.senderName} ${thread.body} ${thread.preview}`.toLowerCase();
        if (!haystack.includes(needle)) {
          return false;
        }
      }
      return true;
    });
  }, [data.threads, kindFilter, platformFilter, query, tab]);

  const selected =
    rows.find((thread) => thread.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-66px)] min-h-[520px] bg-white">
      <section className="flex w-full max-w-[380px] shrink-0 flex-col border-r border-slate-200">
        <div className="flex items-center gap-2 px-4 pt-4">
          {INBOX_PLATFORMS.map((platform) => {
            const isConnected = connected.has(platform);
            const active = platformFilter === platform;
            return (
              <button
                key={platform}
                type="button"
                title={
                  isConnected
                    ? fr
                      ? `Filtrer ${platform.replace("_", " ")}`
                      : `Filter ${platform.replace("_", " ")}`
                    : fr
                      ? "Branchez ce réseau pour recevoir ses messages ici"
                      : "Connect this network to receive inbox items"
                }
                onClick={() => {
                  if (!isConnected) {
                    return;
                  }
                  setPlatformFilter((current) =>
                    current === platform ? "all" : platform,
                  );
                }}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition ${
                  active
                    ? "border-[#1d1d1f] bg-slate-50"
                    : "border-transparent hover:bg-slate-50"
                } ${isConnected ? "" : "opacity-35"}`}
              >
                <SocialPlatformIcon platform={platform} className="h-5 w-5" />
                {attention.has(platform) ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">
                    !
                  </span>
                ) : null}
              </button>
            );
          })}
          <Link
            href={connectionsHref}
            aria-label={fr ? "Ajouter un compte branché" : "Add a connected account"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#1d1d1f] transition hover:bg-slate-50"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-3 flex items-center gap-2 px-4">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{fr ? "Chercher dans la boîte" : "Search inbox"}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={fr ? "Écrivez au moins 3 caractères" : "Write at least 3 characters"}
              className="h-10 w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20"
            />
          </label>
          <div className="relative">
            <button
              type="button"
              aria-label={fr ? "Filtrer par type" : "Filter by type"}
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((open) => !open)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 transition ${
                filterOpen || kindFilter !== "all"
                  ? "bg-slate-100"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              <Filter className="h-4 w-4 text-slate-600" />
            </button>
            {filterOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-[240px] rounded-xl bg-white p-2 shadow-[0_8px_28px_rgba(15,23,42,0.16)]">
                {(
                  [
                    ["private", fr ? "Messages privés" : "Private messages"],
                    ["comment", fr ? "Commentaires" : "Comments"],
                    ["review", fr ? "Avis" : "Reviews"],
                  ] as const
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setKindFilter((current) =>
                        current === kind ? "all" : kind,
                      );
                      setFilterOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 ${
                      kindFilter === kind ? "bg-slate-50" : ""
                    }`}
                  >
                    {label}
                    <span className="flex items-center gap-1">
                      {KIND_PLATFORMS[kind].map((platform) => (
                        <span
                          key={platform}
                          className={
                            connected.has(platform) ? "" : "opacity-35"
                          }
                        >
                          <SocialPlatformIcon
                            platform={platform}
                            className="h-3.5 w-3.5"
                          />
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between border-b border-slate-200 px-4">
          <nav className="-mb-px flex gap-5" aria-label={fr ? "État des conversations" : "Inbox status"}>
            {(
              [
                ["unresolved", fr ? "Non résolues" : "Unresolved"],
                ["unread", fr ? "Non lues" : "Unread"],
                ["all", fr ? "Toutes" : "All"],
              ] as const
            ).map(([id, label]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`relative pb-2.5 text-sm font-medium ${
                    active
                      ? "border-b-2 border-[#1d1d1f] text-[#1d1d1f]"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {label}
                  {id === "unread" && unreadCount > 0 ? (
                    <span className="absolute -right-1.5 top-0 h-1.5 w-1.5 rounded-full bg-red-500" />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              {data.threads.length === 0
                ? fr
                  ? "Aucune conversation pour l’instant. Les avis Google de votre fiche paraissent ici dès qu’ils sont importés ; les messages privés et commentaires des autres réseaux suivront avec leur synchronisation."
                  : "No conversations yet. Google reviews from your profile appear here once imported; private messages and comments from other networks will follow with their sync."
                : fr
                  ? "Aucune conversation ne correspond à ces filtres."
                  : "No conversations match those filters."}
            </p>
          ) : (
            <ul>
              {rows.map((thread) => (
                <InboxThreadRow
                  key={thread.id}
                  thread={thread}
                  selected={selected?.id === thread.id}
                  onSelect={() => setSelectedId(thread.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[#fafbfc] px-6">
        {selected ? (
          <div className="w-full max-w-xl">
            <header className="mb-6 flex items-center gap-3">
              <ThreadAvatar thread={selected} />
              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">
                  {selected.senderName}
                </h2>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {selected.kind === "private"
                    ? fr ? "Message privé" : "Private message"
                    : selected.kind === "comment"
                      ? fr ? "Commentaire" : "Comment"
                      : fr ? "Avis" : "Review"}
                </p>
              </div>
            </header>
            {selected.kind === "review" && (selected.rating || selected.locationTitle) ? (
              <p className="mb-2 text-sm text-slate-600">
                {selected.rating ? (
                  <span className="mr-2 text-amber-500" aria-label={fr ? `${selected.rating} sur 5` : `${selected.rating} out of 5`}>
                    {"★".repeat(selected.rating)}
                    <span className="text-slate-300">{"★".repeat(5 - selected.rating)}</span>
                  </span>
                ) : null}
                {selected.locationTitle ?? ""}
              </p>
            ) : null}
            <div className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
              {selected.body || (fr ? "Avis sans commentaire." : "Rating without a comment.")}
            </div>
            {selected.reply ? (
              <div className="mt-3 rounded-2xl bg-[#eef4ff] px-4 py-3 text-sm leading-6 text-slate-700">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {fr ? "Votre réponse publiée" : "Your published reply"}
                </p>
                {selected.reply}
              </div>
            ) : null}
            {selected.replyHref ? (
              <a
                href={selected.replyHref}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[#2a1728] px-4 text-sm font-semibold text-white hover:bg-[#3b2438]"
              >
                {selected.reply
                  ? fr ? "Voir dans Avis" : "Open in Reviews"
                  : fr ? "Répondre dans Avis" : "Reply in Reviews"}
              </a>
            ) : null}
          </div>
        ) : (
          <div className="text-center">
            <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-slate-100 text-slate-300">
              <MessageCircleWarning className="h-12 w-12" strokeWidth={1.25} />
            </span>
            <p className="mt-5 text-sm text-slate-500">
              {fr ? "Choisissez une conversation à gauche pour commencer." : "Please select a conversation on the left to begin."}
            </p>
          </div>
        )}
      </section>


    </div>
  );
}

function ThreadAvatar({ thread }: { thread: InboxThread }) {
  const platform = isPlatformKey(thread.platform)
    ? thread.platform
    : null;

  return (
    <span className="relative h-11 w-11 shrink-0">
      {thread.senderImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thread.senderImageUrl}
          alt=""
          className="h-11 w-11 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <UserRound className="h-5 w-5" />
        </span>
      )}
      {platform ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
          <SocialPlatformIcon platform={platform} className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </span>
  );
}

function InboxThreadRow({
  thread,
  selected,
  onSelect,
}: {
  thread: InboxThread;
  selected: boolean;
  onSelect: () => void;
}) {
  const fr = useDashboardLanguage() === "fr";
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-[#f0f7ff] ${
          selected ? "bg-[#f0f7ff]" : "bg-white"
        }`}
      >
        <ThreadAvatar thread={thread} />
        <span className="min-w-0">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-[#1d1d1f]">
              {thread.senderName}
            </span>
            <span className="shrink-0 text-[11px] text-slate-400">
              {formatThreadTime(thread.occurredAt, fr)}
            </span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="group/snippet relative min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-slate-400">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{thread.preview}</span>
              </span>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-[calc(100%+8px)] left-0 z-20 hidden max-w-[280px] rounded-lg bg-white px-3 py-2 text-left text-[13px] leading-5 text-[#1d1d1f] shadow-[0_8px_24px_rgba(15,23,42,0.16)] group-hover/snippet:block"
              >
                {thread.body}
              </span>
            </span>
            <Check className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          </span>
        </span>
      </button>
    </li>
  );
}
