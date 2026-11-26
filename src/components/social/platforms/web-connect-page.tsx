"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { WebSiteConnectDialog } from "@/components/social/connections/web-site-connect-dialog";
import { useDashboardLanguage } from "@/components/layout/dashboard-language";

export function WebConnectPage({
  activeBrandId,
  canManage,
  isConnected,
  siteUrl,
  accountName,
  resolutionIssue = null,
}: {
  activeBrandId: string | null;
  canManage: boolean;
  isConnected: boolean;
  siteUrl: string | null;
  accountName: string | null;
  resolutionIssue?: "ambiguous" | "missing" | null;
}) {
  const fr = useDashboardLanguage() === "fr";
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">{fr ? "Statistiques" : "Analytics"}</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">Web</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {fr ? "Branchez un site public à cette marque. Une balise de vérification sur la page d’accueil confirme qu’il lui appartient." : "Connect a public website to this brand. A homepage verification tag confirms the site belongs here."}
        </p>
      </header>

      {resolutionIssue === "ambiguous" ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-7">
          <h2 className="text-xl font-semibold text-slate-950">
            {fr ? "Plus d’un site est branché" : "More than one website is connected"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            {fr ? "Débranchez le site en trop dans les connexions, puis gardez un seul site vérifié pour cette marque." : "Disconnect the extra website from connections, then keep a single verified site for this brand."}
          </p>
        </section>
      ) : isConnected && siteUrl ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-7">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {fr ? "Site Web" : "Website"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            {accountName ?? siteUrl}
          </h2>
          <a
            href={siteUrl}
            className="mt-3 inline-flex text-sm font-medium text-[#4934d4] hover:underline"
            rel="noreferrer"
            target="_blank"
          >
            {siteUrl}
          </a>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
            {fr ? "Ce site est vérifié pour la marque active. Le branchement d’un blogue reste possible une fois le site branché." : "This website is verified for the active brand. Blog connection stays available after the website is connected."}
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-[#b8c1ff] bg-[#f0f1ff] px-6 py-7">
          <h2 className="text-xl font-semibold text-slate-950">
            {fr ? "Branchez votre site Web" : "Connect your website"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {fr ? "Entrez l’adresse https publique. TAKATAK vous donne une balise à placer sur la page d’accueil avant de marquer le site comme branché." : "Enter the public https address. TAKATAK gives you a tag to place on the homepage before the site is marked connected."}
          </p>
          {!activeBrandId ? (
            <p className="mt-4 text-sm text-amber-800">
              {fr ? "Choisissez ou créez une marque avant de brancher un site." : "Select or create a brand before connecting a website."}
            </p>
          ) : !canManage ? (
            <p className="mt-4 text-sm text-slate-600">
              {fr ? "Vous pouvez voir les connexions, mais pas les modifier." : "You can view connections, but you cannot change them."}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#8790f6] px-5 text-sm font-semibold text-white transition hover:bg-[#7883ec]"
            >
              {fr ? "Brancher une page Web" : "Connect a web page"}
            </button>
          )}
        </section>
      )}

      {open && activeBrandId ? (
        <WebSiteConnectDialog
          businessBrandId={activeBrandId}
          onClose={() => setOpen(false)}
          onConnected={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
