"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import { downloadCsv } from "@/components/social/platforms/instagram-live-panels";
import {
  competitorRow,
  mediaInRange,
  toCsv,
  type InstagramLiveMedia,
  type InstagramPublicAccount,
} from "@/lib/social/instagram-live-stats";

type ApiCompetitor = {
  ref: string;
  username: string;
  account: Omit<InstagramPublicAccount, "id"> | null;
};

const fmt = (value: number | null, fr: boolean, suffix = "") =>
  value === null ? "—" : `${value.toLocaleString(fr ? "fr-CA" : "en-CA")}${suffix}`;

/**
 * Instagram competitors read live through Business Discovery: add a public
 * professional account by username, compare followers, posts and engagement,
 * list all their posts of the period, export, remove.
 */
export function InstagramCompetitorsPanel({
  canTrack,
  canManage,
  start,
  end,
  network = "instagram",
}: {
  canTrack: boolean;
  canManage: boolean;
  start: string;
  end: string;
  network?: "instagram" | "bluesky";
}) {
  const fr = useDashboardLanguage() === "fr";
  const bluesky = network === "bluesky";
  const name = bluesky ? "Bluesky" : "Instagram";
  const apiPath = `/api/social/${network}/competitors`;
  const profileUrl = (username: string) => (bluesky ? `https://bsky.app/profile/${username}` : `https://www.instagram.com/${username}/`);
  const [competitors, setCompetitors] = useState<ApiCompetitor[] | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "ok" } | null>(null);
  const [filter, setFilter] = useState("all");
  const [showPosts, setShowPosts] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(apiPath, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; competitors?: ApiCompetitor[] };
      setCompetitors(response.ok && body.ok ? (body.competitors ?? []) : []);
    } catch {
      setCompetitors([]);
    }
  }, [apiPath]);

  useEffect(() => {
    if (canTrack) void load();
  }, [canTrack, load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (response.ok) {
        setUsername("");
        setMessage({ text: fr ? "Concurrent ajouté." : "Competitor added.", tone: "ok" });
        await load();
      } else {
        const text =
          response.status === 404
            ? bluesky
              ? fr ? "Bluesky ne trouve aucun compte à ce nom." : "Bluesky found no account with that handle."
              : fr ? "Instagram ne trouve aucun compte professionnel à ce nom (les comptes personnels ne peuvent pas être suivis)." : "Instagram found no professional account with that username (personal accounts cannot be followed)."
            : response.status === 409
              ? fr ? "Ce concurrent est déjà dans la liste." : "That competitor is already on the list."
              : response.status === 401 || response.status === 403
                ? fr ? "Reconnectez Instagram par votre Page Facebook pour ajouter des concurrents." : "Reconnect Instagram through your Facebook Page to add competitors."
                : response.status === 400
                  ? fr ? "Vérifiez le nom d’utilisateur (par exemple @restaurant) ou la limite de 50 concurrents." : "Check the username (for example @restaurant) or the 50-competitor limit."
                  : fr ? `${name} n’a pas répondu ; réessayez dans un instant.` : `${name} did not answer; try again in a moment.`;
        setMessage({ text, tone: "error" });
      }
    } catch {
      setMessage({ text: fr ? "Vérifiez votre connexion et réessayez." : "Check your connection and try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(ref: string) {
    setBusy(true);
    try {
      const response = await fetch(`${apiPath}?ref=${encodeURIComponent(ref)}`, { method: "DELETE" });
      if (response.ok) await load();
      else setMessage({ text: fr ? "Ce concurrent n’a pas pu être retiré." : "That competitor could not be removed.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(
    () => (competitors ?? []).filter((c) => c.account).map((c) => competitorRow(c.ref, { id: c.ref, ...c.account! }, start, end)),
    [competitors, start, end],
  );
  const visibleRows = filter === "all" ? rows : rows.filter((row) => row.ref === filter);
  const posts = useMemo(() => {
    const list: Array<InstagramLiveMedia & { owner: string; ref: string }> = [];
    for (const c of competitors ?? []) {
      if (!c.account || (filter !== "all" && c.ref !== filter)) continue;
      for (const item of mediaInRange(c.account.media, start, end)) list.push({ ...item, owner: c.account.username, ref: c.ref });
    }
    const query = search.trim().toLowerCase();
    return list
      .filter((item) => !query || item.caption.toLowerCase().includes(query) || item.owner.includes(query))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }, [competitors, filter, start, end, search]);
  const unavailable = (competitors ?? []).filter((c) => !c.account);

  if (!canTrack) {
    return (
      <p className="rounded-[14px] border border-[#E8EAED] bg-white px-6 py-6 text-sm leading-6 text-[#5F6770]">
        {fr
          ? "Instagram permet de lire d’autres comptes seulement quand votre Instagram est branché par votre Page Facebook. Branchez-le par Facebook (bouton plus haut sur cette page) pour suivre vos concurrents : abonnés, publications et engagement, lus en direct."
          : "Instagram lets TAKATAK read other accounts only when your Instagram is linked through your Facebook Page. Link it through Facebook (button above on this page) to follow competitors: followers, posts and engagement, read live."}
      </p>
    );
  }

  const exportCsv = () =>
    showPosts
      ? downloadCsv(
          `${network}-concurrents-publications-${start}-${end}.csv`,
          toCsv(
            [fr ? "Compte" : "Account", "Date", fr ? "Légende" : "Caption", fr ? "J’aime" : "Likes", fr ? "Commentaires" : "Comments", fr ? "Lien" : "Link"],
            posts.map((item) => [item.owner, item.publishedAt.slice(0, 10), item.caption.replace(/\s+/g, " ").trim(), item.likes, item.comments, item.permalink]),
          ),
        )
      : downloadCsv(
          `${network}-concurrents-${start}-${end}.csv`,
          toCsv(
            [fr ? "Compte" : "Account", fr ? "Abonnés" : "Followers", fr ? "Publications (total)" : "Posts (total)", fr ? "Publications de la période" : "Posts in period", "Interactions", fr ? "Interactions par publication" : "Interactions per post", fr ? "Engagement (%)" : "Engagement (%)"],
            visibleRows.map((row) => [row.username, row.followers, row.mediaCount, row.postsInPeriod, row.interactions, row.interactionsPerPost, row.engagementRate]),
          ),
        );

  return (
    <section className="rounded-[14px] border border-[#E8EAED] bg-white px-6 py-6 shadow-[0_2px_12px_rgba(31,41,55,0.04)] sm:px-7">
      {canManage ? (
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={80}
            placeholder={bluesky ? "@compte.bsky.social" : fr ? "@compte_concurrent" : "@competitor_account"}
            aria-label={fr ? `Nom d’utilisateur ${name} du concurrent` : `Competitor's ${name} username`}
            className="h-[42px] w-64 rounded-[9px] border border-[#9EAFBC] bg-white px-4 text-sm text-[#30343A] outline-none focus:border-[#6F7E89]"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-[42px] items-center justify-center rounded-[9px] bg-[#2B1725] px-4 text-sm font-semibold text-[#DFFF38] transition hover:bg-[#3A2133] disabled:opacity-60"
          >
            {busy ? "…" : fr ? "+ Ajouter" : "+ Add"}
          </button>
          <span className="text-xs text-[#81909D]">
            {bluesky
              ? fr ? "Jusqu’à 50 comptes publics." : "Up to 50 public accounts."
              : fr ? "Jusqu’à 50 comptes professionnels publics." : "Up to 50 public professional accounts."}
          </span>
        </form>
      ) : null}
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-3 text-sm ${message.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label={fr ? "Filtrer les concurrents" : "Filter competitors"}
          className="h-[42px] min-w-[180px] rounded-[9px] border border-[#D7DBE0] bg-white px-3 text-xs font-medium text-[#30343A]"
        >
          <option value="all">{fr ? "Tous les concurrents" : "All competitors"}</option>
          {rows.map((row) => (
            <option key={row.ref} value={row.ref}>
              @{row.username}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowPosts((value) => !value)}
          aria-pressed={showPosts}
          className={`inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] border px-3 text-xs font-medium transition ${showPosts ? "border-[#8996F6] bg-[#EEF0FF] text-[#30343A]" : "border-[#D7DBE0] bg-white text-[#30343A] hover:bg-[#F8F9FA]"}`}
        >
          {showPosts ? (fr ? "Voir le tableau des comptes" : "Show the accounts table") : fr ? "Liste des publications (toutes)" : "Post list (all)"}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
        >
          {fr ? "Télécharger le CSV" : "Download CSV"}
        </button>
        {showPosts ? (
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={fr ? "Rechercher" : "Search"}
            aria-label={fr ? "Rechercher dans les publications des concurrents" : "Search competitor posts"}
            className="h-[42px] min-w-0 flex-1 rounded-[9px] border border-[#9EAFBC] bg-white px-4 text-sm text-[#30343A] outline-none focus:border-[#6F7E89]"
          />
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto">
        {competitors === null ? (
          <p className="py-8 text-center text-sm text-[#5F6770]">{fr ? `Lecture des comptes sur ${name}…` : `Reading the accounts on ${name}…`}</p>
        ) : showPosts ? (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#FAFAFA] text-xs text-[#5F6770]">
              <tr>
                <th className="px-3 py-3 font-medium">{fr ? "Compte" : "Account"}</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">{fr ? "Légende" : "Caption"}</th>
                <th className="px-3 py-3 text-right font-medium">{fr ? "J’aime" : "Likes"}</th>
                <th className="px-3 py-3 text-right font-medium">{fr ? "Commentaires" : "Comments"}</th>
                <th className="px-3 py-3 font-medium">{fr ? "Lien" : "Link"}</th>
              </tr>
            </thead>
            <tbody>
              {posts.length ? (
                posts.slice(0, 300).map((item) => (
                  <tr key={`${item.ref}-${item.id}`} className="border-t border-[#EEF0F2] align-top">
                    <td className="px-3 py-3 font-medium">@{item.owner}</td>
                    <td className="px-3 py-3">{item.publishedAt.slice(0, 10)}</td>
                    <td className="max-w-[360px] px-3 py-3"><span className="line-clamp-2">{item.caption || "—"}</span></td>
                    <td className="px-3 py-3 text-right">{fmt(item.likes, fr)}</td>
                    <td className="px-3 py-3 text-right">{fmt(item.comments, fr)}</td>
                    <td className="px-3 py-3">
                      {item.permalink ? (
                        <a href={item.permalink} target="_blank" rel="noreferrer" className="font-medium text-[#566DF1] hover:underline">
                          {fr ? "Ouvrir" : "Open"}
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-[#EEF0F2]">
                  <td colSpan={6} className="px-3 py-8 text-center text-[#5F6770]">
                    {fr ? "Aucune publication des concurrents dans cette période." : "No competitor post in this period."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#FAFAFA] text-xs text-[#5F6770]">
              <tr>
                <th className="px-3 py-3 font-medium">{fr ? "Compte" : "Account"}</th>
                <th className="px-3 py-3 text-right font-medium">{fr ? "Abonnés" : "Followers"}</th>
                <th className="px-3 py-3 text-right font-medium">{fr ? "Publications de la période" : "Posts in period"}</th>
                <th className="px-3 py-3 text-right font-medium">Interactions</th>
                <th className="px-3 py-3 text-right font-medium">{fr ? "Par publication" : "Per post"}</th>
                <th className="px-3 py-3 text-right font-medium">{fr ? "Engagement" : "Engagement"}</th>
                {canManage ? <th className="px-3 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr key={row.ref} className="border-t border-[#EEF0F2]">
                    <td className="px-3 py-3">
                      <a href={profileUrl(row.username)} target="_blank" rel="noreferrer" className="font-medium text-[#30343A] hover:underline">
                        @{row.username}
                      </a>
                      {row.name ? <span className="block text-xs text-[#81909D]">{row.name}</span> : null}
                    </td>
                    <td className="px-3 py-3 text-right">{fmt(row.followers, fr)}</td>
                    <td className="px-3 py-3 text-right">{fmt(row.postsInPeriod, fr)}</td>
                    <td className="px-3 py-3 text-right">{fmt(row.interactions, fr)}</td>
                    <td className="px-3 py-3 text-right">{fmt(row.interactionsPerPost, fr)}</td>
                    <td className="px-3 py-3 text-right">{fmt(row.engagementRate, fr, " %")}</td>
                    {canManage ? (
                      <td className="px-3 py-3 text-right">
                        <button type="button" disabled={busy} onClick={() => remove(row.ref)} className="text-xs font-medium text-rose-700 hover:underline disabled:opacity-50">
                          {fr ? "Retirer" : "Remove"}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr className="border-t border-[#EEF0F2]">
                  <td colSpan={canManage ? 7 : 6} className="px-3 py-8 text-center text-[#5F6770]">
                    {fr ? "Aucun concurrent suivi. Ajoutez un compte public par son nom d’utilisateur." : "No competitor followed yet. Add a public account by its username."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {unavailable.length ? (
          <p className="mt-3 text-xs text-amber-800">
            {fr ? `${name} n’a pas répondu pour : ` : `${name} did not answer for: `}
            {unavailable.map((c) => `@${c.username}`).join(", ")}
            {canManage
              ? unavailable.map((c) => (
                  <button key={c.ref} type="button" onClick={() => remove(c.ref)} className="ml-2 font-medium text-rose-700 hover:underline">
                    {fr ? `retirer @${c.username}` : `remove @${c.username}`}
                  </button>
                ))
              : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}
