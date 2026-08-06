import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import {
  ServiceThumbnail,
  type ServiceThumbnailKind,
} from "@/components/website/marketplace/service-thumbnail";

const FEATURED: Array<{
  slug: string;
  name: string;
  thumb: ServiceThumbnailKind;
  from: string;
}> = [
  {
    slug: "website_design",
    name: "Website Development",
    thumb: "website",
    from: "$180",
  },
  {
    slug: "logo_design",
    name: "Logo & Branding",
    thumb: "logo",
    from: "$25",
  },
  {
    slug: "social_media_content",
    name: "Social Media Content",
    thumb: "social",
    from: "$40",
  },
  {
    slug: "seo_local_visibility",
    name: "Local SEO / QMAPS",
    thumb: "seo",
    from: "$99",
  },
  {
    slug: "lead_generation",
    name: "Lead Generation / FLEXS",
    thumb: "ai",
    from: "$150",
  },
  {
    slug: "data_entry",
    name: "Data Entry",
    thumb: "data",
    from: "$20",
  },
  {
    slug: "mobile_app_design",
    name: "Mobile App Design",
    thumb: "mobile",
    from: "$250",
  },
  {
    slug: "ecommerce_setup",
    name: "Ecommerce Setup",
    thumb: "ecommerce",
    from: "$220",
  },
];

export function FeaturedServicesStrip() {
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            Featured TAKATAK services
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            The most-booked services across
            the TAKATAK marketplace.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {FEATURED.map((service) => (
          <Link
            key={service.slug}
            href={`/marketplace/category/${service.slug}`}
            className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
          >
            <ServiceThumbnail
              kind={service.thumb}
            />

            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">
                  {service.name}
                </div>

                <div className="text-[11px] text-muted-foreground">
                  From {service.from}
                </div>
              </div>

              <ArrowUpRight
                size={16}
                className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}