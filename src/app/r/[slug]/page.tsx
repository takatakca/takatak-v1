import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicRatingForm } from "@/components/reputation/public-rating-form";
import { getPublicReviewPage } from "@/lib/reputation/service";
import { PUBLIC_SLUG_PATTERN } from "@/lib/reputation/validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre avis compte · Your feedback",
  robots: { index: false, follow: false },
};

export default async function PublicReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  if (!PUBLIC_SLUG_PATTERN.test(slug)) notFound();
  const token = typeof t === "string" ? t : null;

  let page;
  try {
    page = await getPublicReviewPage(slug, token);
  } catch {
    page = undefined;
  }
  if (page === null) notFound();

  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-50 px-4 py-10 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {page === undefined ? (
          <p className="text-sm text-slate-600">
            Cette page est temporairement indisponible. Réessayez dans un instant.
            <br />
            <span className="text-slate-400">This page is temporarily unavailable. Please try again shortly.</span>
          </p>
        ) : page.alreadyRated ? (
          <div className="space-y-2 text-center">
            <h1 className="text-xl font-bold text-slate-950">Merci ! 🙏</h1>
            <p className="text-sm text-slate-600">Votre avis pour {page.profileName} a déjà été reçu.</p>
            <p className="text-xs text-slate-400">Your feedback for {page.profileName} was already received.</p>
          </div>
        ) : (
          <PublicRatingForm
            slug={page.publicSlug}
            token={page.requestToken}
            profileName={page.profileName}
            recipientName={page.recipientName}
          />
        )}
        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.18em] text-slate-300">Propulsé par TAKATAK</p>
      </div>
    </main>
  );
}
