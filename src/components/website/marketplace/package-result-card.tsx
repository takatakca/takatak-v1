import Link from "next/link";
import {
  Clock,
  ShieldCheck,
  Star,
} from "lucide-react";

import { ServiceThumbnail } from "@/components/website/marketplace/service-thumbnail";
import {
  formatStartingPrice,
  shortestDelivery,
  type MarketplacePackage,
} from "@/lib/website/marketplace-catalog";

export function PackageResultCard({
  pkg,
}: {
  pkg: MarketplacePackage;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-emerald-500/50 hover:shadow-lg">
      <Link
        href={`/marketplace/gigs/${pkg.id}`}
      >
        <ServiceThumbnail
          kind={pkg.thumb}
        />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {pkg.categoryName}
        </p>

        <Link
          href={`/marketplace/gigs/${pkg.id}`}
          className="mt-1 line-clamp-2 font-semibold leading-snug text-slate-950 transition hover:text-emerald-700"
        >
          {pkg.title}
        </Link>

        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
          {pkg.blurb}
        </p>

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 font-medium text-slate-950">
            <Star
              size={12}
              className="fill-slate-950"
            />

            {pkg.rating.toFixed(1)}
          </span>

          <span>({pkg.reviews})</span>
          <span>·</span>

          <span className="inline-flex items-center gap-1">
            <Clock size={12} />
            {shortestDelivery(pkg)}-day delivery
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Starting at
            </p>

            <p className="text-base font-bold text-slate-950">
              {formatStartingPrice(pkg)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/marketplace/post-project?package=${encodeURIComponent(
                pkg.id,
              )}`}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Request quote
            </Link>

            <Link
              href={`/marketplace/gigs/${pkg.id}`}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              View
            </Link>
          </div>
        </div>

        <p className="mt-3 inline-flex items-center gap-1 text-[10px] text-slate-500">
          <ShieldCheck
            size={11}
            className="text-emerald-700"
          />

          TAKATAK-managed · payment released
          after approval
        </p>
      </div>
    </article>
  );
}