import { Link } from "@/lib/website/nav";
import { ArrowUpRight } from "lucide-react";
import { ServiceThumbnail } from "./ServiceThumbnail";

const FEATURED = [
  { slug: "website_design", name: "Website Development", thumb: "website" as const, from: "$180" },
  { slug: "logo_design", name: "Logo & Branding", thumb: "logo" as const, from: "$25" },
  { slug: "social_media_content", name: "Social Media Content", thumb: "social" as const, from: "$40" },
  { slug: "seo_local_visibility", name: "Local SEO / QMAPS", thumb: "seo" as const, from: "$99" },
  { slug: "lead_generation", name: "Lead Generation / FLEXS", thumb: "ai" as const, from: "$150" },
  { slug: "data_entry", name: "Data Entry", thumb: "data" as const, from: "$20" },
  { slug: "mobile_app_design", name: "Mobile App Design", thumb: "mobile" as const, from: "$250" },
  { slug: "ecommerce_setup", name: "Ecommerce Setup", thumb: "ecommerce" as const, from: "$220" },
];

export function FeaturedServicesStrip() {
  return (
    <section>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Featured TAKATAK services</h2>
          <p className="mt-1 text-sm text-muted-foreground">The most-booked services across the TAKATAK marketplace.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {FEATURED.map((f) => (
          <Link
            key={f.slug}
            to="/marketplace/category/$slug"
            params={{ slug: f.slug }}
            className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-[var(--shadow-card)] transition-all"
          >
            <ServiceThumbnail kind={f.thumb} />
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">{f.name}</div>
                <div className="text-[11px] text-muted-foreground">From {f.from}</div>
              </div>
              <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}