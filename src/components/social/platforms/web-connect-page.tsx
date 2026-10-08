"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { WebSiteConnectDialog } from "@/components/social/connections/web-site-connect-dialog";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">Analytics</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">Web</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Connect a public website to this brand. A homepage verification tag
          confirms the site belongs here.
        </p>
      </header>

      {resolutionIssue === "ambiguous" ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-7">
          <h2 className="text-xl font-semibold text-slate-950">
            More than one website is connected
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Disconnect the extra website from connections, then keep a single
            verified site for this brand.
          </p>
        </section>
      ) : isConnected && siteUrl ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-7">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Website
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
            This website is verified for the active brand. Blog connection stays
            available after the website is connected.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-[#b8c1ff] bg-[#f0f1ff] px-6 py-7">
          <h2 className="text-xl font-semibold text-slate-950">
            Connect your website
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Enter the public https address. TAKATAK gives you a tag to place on
            the homepage before the site is marked connected.
          </p>
          {!activeBrandId ? (
            <p className="mt-4 text-sm text-amber-800">
              Select or create a brand before connecting a website.
            </p>
          ) : !canManage ? (
            <p className="mt-4 text-sm text-slate-600">
              You can view connections, but you cannot change them.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#8790f6] px-5 text-sm font-semibold text-white transition hover:bg-[#7883ec]"
            >
              Connect a web page
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
