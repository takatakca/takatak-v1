"use client";

import { useMemo, useState } from "react";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import { SocialSummaryChart } from "@/components/social/analytics/social-summary-chart";
import { metricValue } from "@/components/social/analytics/social-summary-tokens";
import {
  dailyInteractions,
  enumerateDays,
  hashtagsFromMedia,
  mediaInRange,
  mediaTypeBreakdown,
  summarizeMedia,
  toCsv,
  type InstagramLiveMedia,
  type InstagramLiveStats,
  type InstagramMediaKind,
} from "@/lib/social/instagram-live-stats";

// Instagram panels filled with the account's real numbers (read live from
// Instagram with the workspace's own connection). French first.

type Lang = "fr" | "en";

const fmt = (value: number | null, lang: Lang, suffix = "") =>
  value === null ? "—" : `${value.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")}${suffix}`;

const TYPE_LABEL: Record<string, { fr: string; en: string }> = {
  IMAGE: { fr: "Photo", en: "Photo" },
  VIDEO: { fr: "Vidéo", en: "Video" },
  CAROUSEL_ALBUM: { fr: "Carrousel", en: "Carousel" },
};

const typeLabel = (type: string, lang: Lang) => TYPE_LABEL[type]?.[lang] ?? type;

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Column picker: a real menu that shows or hides table columns. */
export function ColumnsMenu({
  columns,
  visible,
  onToggle,
  label,
}: {
  columns: Array<{ key: string; label: string; required?: boolean }>;
  visible: Set<string>;
  onToggle: (key: string) => void;
  label: string;
}) {
  return (
    <details className="relative">
      <summary
        aria-label={label}
        className="inline-flex h-[42px] cursor-pointer list-none items-center justify-center gap-2 rounded-[9px] border border-[#D7DBE0] bg-white px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F8F9FA] [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="4" width="14" height="12" rx="2" />
          <path d="M8 4v12M12 4v12" />
        </svg>
        {label}
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-[#E1E4E7] bg-white p-2 shadow-lg">
        {columns.map((column) => (
          <label key={column.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#30343A] hover:bg-[#F4F5F6]">
            <input
              type="checkbox"
              checked={visible.has(column.key)}
              disabled={column.required}
              onChange={() => onToggle(column.key)}
              className="h-3.5 w-3.5 accent-[#566DF1]"
            />
            {column.label}
          </label>
        ))}
      </div>
    </details>
  );
}

function Card({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex min-h-[86px] flex-col items-center justify-center rounded-[9px] px-4 py-3 text-center" style={{ backgroundColor: color }}>
      <p className="text-[24px] font-normal leading-none text-[#27303A]">{value}</p>
      <p className="mt-3 text-[12px] font-medium text-[#3F454C]">{label}</p>
    </div>
  );
}

function GreyCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-h-[92px] flex-col items-center justify-center rounded-[9px] bg-[#E8EAEC] px-4 py-4 text-center">
      <p className="text-[22px] font-normal leading-none text-[#20242A]">{value}</p>
      <p className="mt-3 text-[12px] font-medium text-[#505761]">{label}</p>
    </div>
  );
}

/** Freshness and the parts Instagram did not give, said plainly. */
export function InstagramLiveNote({ stats }: { stats: InstagramLiveStats }) {
  const lang = useDashboardLanguage();
  const time = new Date(stats.fetchedAt).toLocaleTimeString(lang === "fr" ? "fr-CA" : "en-CA", { hour: "2-digit", minute: "2-digit" });
  const missingLabels: Record<string, { fr: string; en: string }> = {
    profile: { fr: "le profil", en: "the profile" },
    media: { fr: "la liste des publications", en: "the media list" },
    media_insights: { fr: "la portée et les vues par publication", en: "reach and views per post" },
    account_insights: { fr: "les statistiques du compte", en: "account insights" },
    new_followers: { fr: "les nouveaux abonnés par jour", en: "new followers per day" },
    older_media: { fr: "les publications les plus anciennes (Instagram a répondu trop lentement)", en: "the oldest posts (Instagram answered too slowly)" },
  };
  const missing = stats.missing.map((key) => missingLabels[key]?.[lang]).filter(Boolean);
  return (
    <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] leading-5 text-emerald-950">
      {lang === "fr"
        ? `Chiffres lus en direct sur Instagram à ${time} (mis à jour toutes les 10 minutes).`
        : `Numbers read live from Instagram at ${time} (refreshed every 10 minutes).`}
      {missing.length ? (
        <span className="block text-amber-900">
          {lang === "fr"
            ? `Instagram n’a pas fourni ${missing.join(", ")} : reconnectez le compte avec l’accès aux statistiques pour les voir.`
            : `Instagram did not provide ${missing.join(", ")}: reconnect the account with insights access to see them.`}
        </span>
      ) : null}
    </div>
  );
}

type MediaColumn = "date" | "type" | "caption" | "likes" | "comments" | "views" | "reach" | "saved" | "shares" | "link";

const ALL_COLUMNS: MediaColumn[] = ["date", "type", "caption", "likes", "comments", "views", "reach", "saved", "shares", "link"];

function columnLabel(key: MediaColumn, lang: Lang): string {
  const labels: Record<MediaColumn, [string, string]> = {
    date: ["Date", "Date"],
    type: ["Type", "Type"],
    caption: ["Légende", "Caption"],
    likes: ["J’aime", "Likes"],
    comments: ["Commentaires", "Comments"],
    views: ["Vues", "Views"],
    reach: ["Portée", "Reach"],
    saved: ["Enregistrements", "Saved"],
    shares: ["Partages", "Shares"],
    link: ["Lien", "Link"],
  };
  return labels[key][lang === "fr" ? 0 : 1];
}

function cellValue(item: InstagramLiveMedia, key: MediaColumn, lang: Lang): string | number | null {
  switch (key) {
    case "date":
      return item.publishedAt.slice(0, 10);
    case "type":
      return typeLabel(item.mediaType, lang);
    case "caption":
      return item.caption.replace(/\s+/g, " ").trim();
    case "link":
      return item.permalink;
    default:
      return item[key];
  }
}

/** Posts or Reels published in the period, from the account's real media. */
export function InstagramLiveMediaSection({
  stats,
  kind,
  start,
  end,
}: {
  stats: InstagramLiveStats;
  kind: InstagramMediaKind;
  start: string;
  end: string;
}) {
  const lang = useDashboardLanguage();
  const fr = lang === "fr";
  const [search, setSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [visible, setVisible] = useState<Set<string>>(
    () => new Set<MediaColumn>(["date", "type", "caption", "likes", "comments", "views", "reach", "link"]),
  );
  const days = enumerateDays(start, end).length;
  const items = useMemo(
    () => mediaInRange(stats.media, start, end, kind).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [stats.media, start, end, kind],
  );
  const summary = useMemo(() => summarizeMedia(items, days), [items, days]);
  const points = useMemo(
    () => dailyInteractions(items, start, end).map((point) => ({ date: point.date, value: metricValue(point.value) })),
    [items, start, end],
  );
  const types = useMemo(() => mediaTypeBreakdown(items), [items]);
  const tags = useMemo(() => hashtagsFromMedia(items), [items]);
  const query = search.trim().toLowerCase();
  const rows = query ? items.filter((item) => item.caption.toLowerCase().includes(query)) : items;
  const tagQuery = tagSearch.trim().toLowerCase().replace(/^#/, "");
  const tagRows = tagQuery ? tags.filter((tag) => tag.tag.includes(tagQuery)) : tags;
  const columns = ALL_COLUMNS.filter((key) => visible.has(key));
  const noun = kind === "reel" ? (fr ? "reels" : "reels") : fr ? "publications" : "posts";

  const toggle = (key: string) =>
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const exportRows = () =>
    downloadCsv(
      `instagram-${kind === "reel" ? "reels" : "publications"}-${start}-${end}.csv`,
      toCsv(
        columns.map((key) => columnLabel(key, lang)),
        rows.map((item) => columns.map((key) => cellValue(item, key, lang))),
      ),
    );

  return (
    <div className="space-y-5">
      <h1 className="text-[23px] font-medium text-[#20242A]">
        {kind === "reel"
          ? fr ? "Reels publiés dans la période" : "Reels published in period"
          : fr ? "Publications de la période" : "Posts published in period"}
      </h1>

      <div className="overflow-hidden rounded-[14px] border border-[#E8EAED] bg-white shadow-[0_2px_12px_rgba(31,41,55,0.04)]">
        <section className="px-5 py-7 sm:px-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card value={fmt(summary.engagementRate, lang, " %")} label={fr ? "Taux d’engagement" : "Engagement rate"} color="#8994F0" />
            <Card value={fmt(summary.interactions, lang)} label={fr ? "Interactions" : "Interactions"} color="#96D0A7" />
            <Card value={fmt(summary.averageReach, lang)} label={fr ? "Portée moyenne" : "Avg. reach"} color="#F0A0DB" />
            <Card value={fmt(summary.views, lang)} label={fr ? "Vues" : "Views"} color="#BA89B2" />
            <Card value={fmt(summary.count, lang)} label={kind === "reel" ? "Reels" : fr ? "Publications" : "Posts"} color="#E9AA2C" />
          </div>
          <div className="mt-2 min-h-[270px]">
            <SocialSummaryChart points={points} seriesLabel={fr ? "Interactions" : "Interactions"} seriesColor="#C58AB5" showMarkers />
          </div>
        </section>

        <section className="border-t border-[#E8EAED] px-5 py-7 sm:px-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card value={fmt(summary.likes, lang)} label={fr ? "J’aime" : "Likes"} color="#96D0A7" />
            <Card value={fmt(summary.comments, lang)} label={fr ? "Commentaires" : "Comments"} color="#F0A0DB" />
            <Card value={fmt(summary.saved, lang)} label={fr ? "Enregistrements" : "Saved"} color="#BA89B2" />
            <Card value={fmt(summary.shares, lang)} label={fr ? "Partages" : "Shares"} color="#AEB8F4" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <GreyCard value={fmt(summary.dailyLikes, lang)} label={fr ? "J’aime par jour" : "Daily likes"} />
            <GreyCard value={fmt(summary.likesPerPost, lang)} label={fr ? "J’aime par publication" : "Likes per post"} />
            <GreyCard value={fmt(summary.dailyComments, lang)} label={fr ? "Commentaires par jour" : "Daily comments"} />
            <GreyCard value={fmt(summary.commentsPerPost, lang)} label={fr ? "Commentaires par publication" : "Comments per post"} />
            <GreyCard value={fmt(summary.likesPerComment, lang)} label={fr ? "J’aime par commentaire" : "Likes per comment"} />
          </div>
          {kind === "post" ? (
            <div className="mt-8">
              <h3 className="text-[18px] font-medium text-[#20242A]">{fr ? "Types et vues" : "Types and views"}</h3>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="bg-[#FAFAFA] text-xs text-[#5F6770]">
                  <tr>
                    <th className="px-4 py-3 font-medium">{fr ? "Type" : "Type"}</th>
                    <th className="px-4 py-3 text-right font-medium">{fr ? "Nombre" : "Count"}</th>
                    <th className="px-4 py-3 text-right font-medium">{fr ? "Vues" : "Views"}</th>
                  </tr>
                </thead>
                <tbody>
                  {types.length ? (
                    types.map((row) => (
                      <tr key={row.type} className="border-t border-[#EEF0F2]">
                        <td className="px-4 py-3">{typeLabel(row.type, lang)}</td>
                        <td className="px-4 py-3 text-right">{fmt(row.count, lang)}</td>
                        <td className="px-4 py-3 text-right">{fmt(row.views, lang)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-[#EEF0F2]">
                      <td colSpan={3} className="px-4 py-4 text-center text-[#5F6770]">
                        {fr ? "Aucune publication dans cette période." : "No post in this period."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className="border-t border-[#E8EAED] px-5 pb-6 pt-8 sm:px-7">
          <h2 className="mb-5 text-[20px] font-medium text-[#20242A]">
            {kind === "reel" ? (fr ? "Liste des reels" : "List of reels") : fr ? "Liste des publications" : "List of posts"}
          </h2>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={fr ? "Rechercher dans les légendes" : "Search captions"}
              aria-label={fr ? `Rechercher des ${noun}` : `Search ${noun}`}
              className="h-[42px] min-w-0 flex-1 rounded-[9px] border border-[#9EAFBC] bg-white px-4 text-sm text-[#30343A] outline-none focus:border-[#6F7E89]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <ColumnsMenu
                label={fr ? "Colonnes" : "Columns"}
                columns={ALL_COLUMNS.map((key) => ({ key, label: columnLabel(key, lang), required: key === "date" }))}
                visible={visible}
                onToggle={toggle}
              />
              <button
                type="button"
                onClick={exportRows}
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
              >
                {fr ? "Télécharger le CSV" : "Download CSV"}
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#FAFAFA] text-xs text-[#5F6770]">
                <tr>
                  {columns.map((key) => (
                    <th key={key} className={`px-3 py-3 font-medium ${key === "caption" || key === "date" || key === "type" || key === "link" ? "" : "text-right"}`}>
                      {columnLabel(key, lang)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((item) => (
                    <tr key={item.id} className="border-t border-[#EEF0F2] align-top">
                      {columns.map((key) => {
                        const value = cellValue(item, key, lang);
                        if (key === "link") {
                          return (
                            <td key={key} className="px-3 py-3">
                              {item.permalink ? (
                                <a href={item.permalink} target="_blank" rel="noreferrer" className="font-medium text-[#566DF1] hover:underline">
                                  {fr ? "Ouvrir" : "Open"}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        }
                        if (key === "caption") {
                          return (
                            <td key={key} className="max-w-[360px] px-3 py-3 text-[#30343A]">
                              <span className="line-clamp-2">{String(value || "—")}</span>
                            </td>
                          );
                        }
                        return (
                          <td key={key} className={`px-3 py-3 ${typeof value === "number" || value === null ? "text-right" : ""}`}>
                            {typeof value === "number" ? fmt(value, lang) : value ?? "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-[#EEF0F2]">
                    <td colSpan={columns.length} className="px-3 py-8 text-center text-[#5F6770]">
                      {query
                        ? fr ? `Aucune légende ne contient « ${search.trim()} ».` : `No caption contains “${search.trim()}”.`
                        : fr ? `Aucun ${kind === "reel" ? "reel" : "post"} publié dans cette période.` : `No ${kind === "reel" ? "reel" : "post"} published in this period.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {kind === "post" ? (
          <section className="border-t border-[#E8EAED] px-5 pb-6 pt-8 sm:px-7">
            <h2 className="mb-5 text-[20px] font-medium text-[#20242A]">{fr ? "Mots-clics utilisés" : "Hashtags used"}</h2>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <input
                type="search"
                value={tagSearch}
                onChange={(event) => setTagSearch(event.target.value)}
                placeholder={fr ? "Rechercher un mot-clic" : "Search a hashtag"}
                aria-label={fr ? "Rechercher un mot-clic" : "Search a hashtag"}
                className="h-[42px] min-w-0 flex-1 rounded-[9px] border border-[#9EAFBC] bg-white px-4 text-sm text-[#30343A] outline-none focus:border-[#6F7E89]"
              />
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `instagram-mots-clics-${start}-${end}.csv`,
                    toCsv(
                      [fr ? "Mot-clic" : "Hashtag", fr ? "Publications" : "Posts", "Interactions"],
                      tagRows.map((tag) => [tag.tag, tag.posts, tag.interactions]),
                    ),
                  )
                }
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
              >
                {fr ? "Télécharger le CSV" : "Download CSV"}
              </button>
            </div>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="bg-[#FAFAFA] text-xs text-[#5F6770]">
                <tr>
                  <th className="px-3 py-3 font-medium">{fr ? "Mot-clic" : "Hashtag"}</th>
                  <th className="px-3 py-3 text-right font-medium">{fr ? "Publications" : "Posts"}</th>
                  <th className="px-3 py-3 text-right font-medium">Interactions</th>
                </tr>
              </thead>
              <tbody>
                {tagRows.length ? (
                  tagRows.slice(0, 100).map((tag) => (
                    <tr key={tag.tag} className="border-t border-[#EEF0F2]">
                      <td className="px-3 py-3 font-medium text-[#30343A]">{tag.tag}</td>
                      <td className="px-3 py-3 text-right">{fmt(tag.posts, lang)}</td>
                      <td className="px-3 py-3 text-right">{fmt(tag.interactions, lang)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-[#EEF0F2]">
                    <td colSpan={3} className="px-3 py-8 text-center text-[#5F6770]">
                      {fr ? "Aucun mot-clic dans les légendes de cette période." : "No hashtag in this period's captions."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** Account insights for the last 30 days (reach, views, interactions, profile activity). */
export function InstagramLiveAccountSection({ stats }: { stats: InstagramLiveStats }) {
  const lang = useDashboardLanguage();
  const fr = lang === "fr";
  const account = stats.account;
  const points = useMemo(() => {
    if (!account) return [];
    const values = new Map(account.reachSeries.map((point) => [point.date, point.value]));
    return enumerateDays(account.since, account.until).map((date) => ({ date, value: metricValue(values.get(date) ?? null) }));
  }, [account]);
  if (!account) {
    return (
      <div className="space-y-4">
        <h1 className="text-[23px] font-medium text-[#20242A]">{fr ? "Compte" : "Account"}</h1>
        <p className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 text-sm text-[#5F6770]">
          {fr
            ? "Instagram n’a pas donné les statistiques du compte. Reconnectez le compte en acceptant l’accès aux statistiques : la portée, les vues et l’activité du profil s’afficheront ici."
            : "Instagram did not provide account insights. Reconnect the account and accept insights access: reach, views and profile activity will show here."}
        </p>
      </div>
    );
  }
  const reachTotal = account.reachSeries.length ? account.reachSeries.reduce((total, point) => total + point.value, 0) : null;
  return (
    <div className="space-y-5">
      <h1 className="text-[23px] font-medium text-[#20242A]">{fr ? "Compte · 30 derniers jours" : "Account · last 30 days"}</h1>
      <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 shadow-[0_2px_12px_rgba(31,41,55,0.04)] sm:px-7">
        <h2 className="text-[18px] font-medium text-[#20242A]">{fr ? "Portée et vues" : "Reach and views"}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card value={fmt(reachTotal, lang)} label={fr ? "Portée (somme des jours)" : "Reach (sum of days)"} color="#8994F0" />
          <Card value={fmt(account.views, lang)} label={fr ? "Vues" : "Views"} color="#BA89B2" />
          <Card value={fmt(account.accountsEngaged, lang)} label={fr ? "Comptes engagés" : "Accounts engaged"} color="#96D0A7" />
          <Card value={fmt(account.totalInteractions, lang)} label={fr ? "Interactions" : "Interactions"} color="#F0A0DB" />
        </div>
        <div className="mt-2 min-h-[270px]">
          <SocialSummaryChart points={points} seriesLabel={fr ? "Portée" : "Reach"} seriesColor="#8994F0" showMarkers />
        </div>
      </section>
      <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 shadow-[0_2px_12px_rgba(31,41,55,0.04)] sm:px-7">
        <h2 className="text-[18px] font-medium text-[#20242A]">{fr ? "Interactions et activité du profil" : "Interactions and profile activity"}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <GreyCard value={fmt(account.likes, lang)} label={fr ? "J’aime" : "Likes"} />
          <GreyCard value={fmt(account.comments, lang)} label={fr ? "Commentaires" : "Comments"} />
          <GreyCard value={fmt(account.saves, lang)} label={fr ? "Enregistrements" : "Saves"} />
          <GreyCard value={fmt(account.shares, lang)} label={fr ? "Partages" : "Shares"} />
          <GreyCard value={fmt(account.profileLinksTaps, lang)} label={fr ? "Clics sur les liens du profil" : "Profile link taps"} />
          <GreyCard value={fmt(account.follows, lang)} label={fr ? "Nouveaux abonnements" : "Follows"} />
          <GreyCard value={fmt(account.unfollows, lang)} label={fr ? "Désabonnements" : "Unfollows"} />
          <GreyCard value={fmt(stats.followers, lang)} label={fr ? "Abonnés aujourd’hui" : "Followers today"} />
        </div>
      </section>
    </div>
  );
}
