"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BlogConnectDialog } from "@/components/social/connections/blog-connect-dialog";
import { useDashboardLanguage } from "@/components/layout/dashboard-language";

export function BlogConnectPage({
  activeBrandId,
  canManage,
  isConnected,
  siteUrl,
  blogUrl,
  accountName,
  needsWebsite = false,
  resolutionIssue = null,
}: {
  activeBrandId: string | null;
  canManage: boolean;
  isConnected: boolean;
  siteUrl: string | null;
  blogUrl: string | null;
  accountName: string | null;
  needsWebsite?: boolean;
  resolutionIssue?: "ambiguous" | "missing" | null;
}) {
  const fr = useDashboardLanguage() === "fr";
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">{fr ? "Statistiques" : "Analytics"}</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">Blog</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {fr ? "TAKATAK crée une page de blogue pour un site déjà branché à cette marque." : "TAKATAK creates a blog page for a website that is already connected to this brand."}
        </p>
      </header>

      {resolutionIssue === "ambiguous" ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-7">
          <h2 className="text-xl font-semibold text-slate-950">
            {fr ? "Plus d’un blogue est branché" : "More than one blog is connected"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            {fr ? "Débranchez le blogue en trop et gardez une seule page de blogue TAKATAK pour cette marque." : "Disconnect the extra blog and keep a single TAKATAK blog page for this brand."}
          </p>
        </section>
      ) : isConnected && blogUrl ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-7">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {fr ? "Page de blogue" : "Blog page"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            {accountName ?? "Blog"}
          </h2>
          <a
            href={blogUrl}
            className="mt-3 inline-flex text-sm font-medium text-[#4934d4] hover:underline"
            rel="noreferrer"
            target="_blank"
          >
            {blogUrl}
          </a>
          {siteUrl ? (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Linked website: {siteUrl}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-[#d5e4e7] bg-[#f4f8f8] px-6 py-7">
          <h2 className="text-xl font-semibold text-slate-950">
            {needsWebsite ? "Connect a web page first" : "Create the blog page"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {needsWebsite
              ? "A blog page belongs to a verified website. Connect the website, then create its TAKATAK blog page."
              : "TAKATAK will publish a blog page for the connected website."}
          </p>
          {!activeBrandId ? (
            <p className="mt-4 text-sm text-amber-800">
              {fr ? "Choisissez ou créez une marque avant de brancher un blogue." : "Select or create a brand before connecting a blog."}
            </p>
          ) : !canManage ? (
            <p className="mt-4 text-sm text-slate-600">
              {fr ? "Vous pouvez voir les connexions, mais pas les modifier." : "You can view connections, but you cannot change them."}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#b8cdd1] px-5 text-sm font-semibold text-slate-950 transition hover:bg-[#aac1c6]"
            >
              {needsWebsite ? "Connect a blog" : "Create blog page"}
            </button>
          )}
        </section>
      )}

      {open && activeBrandId ? (
        <BlogConnectDialog
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
