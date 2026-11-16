"use client";

import Image from "next/image";

import type { MetaAdCreativeReportRow } from "@/lib/social/analytics/meta-ad-creative-mapping";

/** Displays only read-only thumbnails/copy returned by an authorized Meta Ads report. */
export function MetaCreativeGalleryPanel({
  rows,
  locale,
}: {
  rows: readonly MetaAdCreativeReportRow[];
  locale: "fr" | "en";
}) {
  const fr = locale === "fr";
  const eligible = rows.filter((ad) =>
    Boolean(ad.creativeId && (ad.creativeThumbnailUrl || ad.creativeTitle ||
      ad.creativeBody || ad.creativeVideoId || ad.creativeCallToAction)),
  ).slice(0, 12);

  return (
    <section aria-labelledby="meta-creative-gallery-title" className="mt-5 rounded-lg border border-[#DCE7F7] bg-[#F8FBFF] p-4 sm:p-5">
      <h4 id="meta-creative-gallery-title" className="text-base font-semibold text-[#10213A]">
        {fr ? "Aperçu des créations publicitaires" : "Ad creative gallery"}
      </h4>
      <p className="mt-2 text-sm leading-6 text-[#475569]">
        {fr
          ? "Miniatures et textes reçus de Meta pour les publicités de ce compte. Les variantes Advantage+ et les éléments dynamiques ne sont pas détaillés, et une miniature n'est pas une vidéo lisible."
          : "Meta-returned thumbnails and copy for ads in this account. Advantage+ or dynamic variants are not broken down; a thumbnail is not a playable video."}
      </p>
      {eligible.length === 0 ? (
        <p className="mt-3 rounded-md bg-white p-3 text-sm text-[#64748B]" role="status">
          {fr ? "Aucun contenu de création accessible pour la période." : "No creative content was returned for this reporting period."}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {eligible.map((ad) => (
            <article key={ad.adId} className="min-w-0 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
              {ad.creativeThumbnailUrl ? (
                <div className="relative aspect-video overflow-hidden bg-[#E2E8F0]">
                  <Image
                    src={ad.creativeThumbnailUrl}
                    alt={fr ? `Miniature de la publicité ${ad.adName}` : `Thumbnail for ad ${ad.adName}`}
                    fill
                    unoptimized
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-[#F1F5F9] p-4 text-center text-xs text-[#64748B]">
                  {fr ? "Miniature indisponible" : "Thumbnail unavailable"}
                </div>
              )}
              <div className="space-y-2 p-4">
                <h5 className="break-words text-sm font-semibold text-[#10213A]">{ad.adName}</h5>
                {ad.creativeTitle ? <p className="break-words text-sm font-medium text-[#334155]">{ad.creativeTitle}</p> : null}
                {ad.creativeBody ? <p className="break-words text-xs leading-5 text-[#475569]">{ad.creativeBody}</p> : null}
                <div className="flex flex-wrap gap-2 text-xs text-[#64748B]">
                  {ad.creativeType ? <span>{ad.creativeType}</span> : null}
                  {ad.creativeVideoId ? <span>{fr ? "Vidéo" : "Video"} · ID {ad.creativeVideoId}</span> : null}
                  {ad.creativeCallToAction ? <span>{fr ? "Action" : "CTA"} · {ad.creativeCallToAction.replaceAll("_", " ")}</span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-[#64748B]">
        {fr
          ? "Jusqu'à 12 aperçus par rapport. Les URL signées peuvent expirer et les créations non prises en charge restent indisponibles."
          : "Up to 12 previews per report. Signed URLs may expire, and unsupported ad formats remain unavailable."}
      </p>
    </section>
  );
}
