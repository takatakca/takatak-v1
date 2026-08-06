import Link from "next/link";
import {
  Clock,
  ShieldCheck,
  Star,
} from "lucide-react";

import {
  ServiceThumbnail,
  type ServiceThumbnailKind,
} from "@/components/website/marketplace/service-thumbnail";

type Service = {
  slug: string;
  title: string;
  category: string;
  blurb: string;
  price: string;
  delivery: string;
  rating: string;
  reviews: number;
  tag?:
    | "Most popular"
    | "Trending"
    | "New";
  thumb: ServiceThumbnailKind;
};

const SERVICES: Service[] = [
  {
    slug: "website_design",
    title:
      "Build a fast business website",
    category:
      "Website Development",
    blurb:
      "Responsive, SEO-ready WordPress or Next.js build with CMS access.",
    price: "$180",
    delivery: "5 days",
    rating: "4.9",
    reviews: 312,
    tag: "Most popular",
    thumb: "website",
  },
  {
    slug: "mobile_app_design",
    title:
      "iOS & Android app UI design",
    category: "Mobile App Design",
    blurb:
      "Modern app screens with prototype, ready for development handoff.",
    price: "$250",
    delivery: "7 days",
    rating: "4.8",
    reviews: 184,
    thumb: "mobile",
  },
  {
    slug: "logo_design",
    title:
      "Distinctive brand logo design",
    category: "Logo Design",
    blurb:
      "3 unique concepts, unlimited revisions, full source files included.",
    price: "$25",
    delivery: "2 days",
    rating: "5.0",
    reviews: 821,
    tag: "Trending",
    thumb: "logo",
  },
  {
    slug: "branding",
    title: "Full brand identity kit",
    category: "Branding",
    blurb:
      "Logo, colors, typography, and a usage guideline document.",
    price: "$140",
    delivery: "6 days",
    rating: "4.9",
    reviews: 96,
    thumb: "branding",
  },
  {
    slug: "social_media_content",
    title:
      "Monthly social media content pack",
    category:
      "Social Media Content",
    blurb:
      "12 branded posts with captions ready for Instagram & Facebook.",
    price: "$40",
    delivery: "4 days",
    rating: "4.8",
    reviews: 277,
    thumb: "social",
  },
  {
    slug: "seo_local_visibility",
    title:
      "Local SEO & Google Business setup",
    category:
      "SEO & Local Visibility",
    blurb:
      "On-page SEO, local citations, and Google Business optimisation.",
    price: "$99",
    delivery: "5 days",
    rating: "4.7",
    reviews: 152,
    thumb: "seo",
  },
  {
    slug: "data_entry",
    title:
      "Accurate data entry & cleanup",
    category: "Data Entry",
    blurb:
      "Spreadsheet entry, scraping, and structured cleanup at scale.",
    price: "$20",
    delivery: "2 days",
    rating: "4.9",
    reviews: 410,
    thumb: "data",
  },
  {
    slug: "menu_design",
    title:
      "Restaurant menu design",
    category: "Menu Design",
    blurb:
      "Print-ready menu design with on-brand layout and typography.",
    price: "$45",
    delivery: "3 days",
    rating: "4.9",
    reviews: 138,
    thumb: "menu",
  },
  {
    slug: "flyer_design",
    title: "Flyer & promo design",
    category: "Flyer Design",
    blurb:
      "Eye-catching flyer for events, promos, and local advertising.",
    price: "$30",
    delivery: "2 days",
    rating: "4.8",
    reviews: 201,
    thumb: "flyer",
  },
  {
    slug: "ecommerce_setup",
    title:
      "Shopify / WooCommerce store setup",
    category: "Ecommerce Setup",
    blurb:
      "Storefront, products, payments, and shipping configured end-to-end.",
    price: "$220",
    delivery: "7 days",
    rating: "4.8",
    reviews: 87,
    thumb: "ecommerce",
  },
  {
    slug: "automation_setup",
    title:
      "Workflow automation setup",
    category: "Automation Setup",
    blurb:
      "Connect your tools with reliable, monitored automations.",
    price: "$120",
    delivery: "4 days",
    rating: "4.9",
    reviews: 64,
    tag: "New",
    thumb: "automation",
  },
  {
    slug: "ai_tool_setup",
    title:
      "AI assistant setup for your business",
    category: "AI Tool Setup",
    blurb:
      "Custom GPT or chatbot trained on your business knowledge base.",
    price: "$150",
    delivery: "5 days",
    rating: "4.9",
    reviews: 51,
    tag: "New",
    thumb: "ai",
  },
];

export function PopularServicesGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {SERVICES.map((service) => (
        <Link
          key={service.slug}
          href={`/marketplace/category/${service.slug}`}
          className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 z-10 h-[3px]"
            style={{
              background:
                "linear-gradient(90deg, var(--brand-dark), var(--brand-accent-cyan) 60%, var(--brand-accent-violet))",
            }}
          />

          <div className="relative">
            <ServiceThumbnail
              kind={service.thumb}
            />

            {service.tag ? (
              <span className="absolute left-3 top-3 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground shadow-sm">
                {service.tag}
              </span>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {service.category}
            </div>

            <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
              {service.title}
            </h3>

            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
              {service.blurb}
            </p>

            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck
                size={11}
                className="text-primary"
              />

              Managed by TAKATAK
            </div>

            <div className="mt-3 flex items-center gap-1 text-xs">
              <Star
                size={13}
                className="fill-foreground text-foreground"
              />

              <span className="font-semibold text-foreground">
                {service.rating}
              </span>

              <span className="text-muted-foreground">
                ({service.reviews})
              </span>

              <span className="mx-1.5 text-muted-foreground">
                ·
              </span>

              <Clock
                size={12}
                className="text-muted-foreground"
              />

              <span className="text-muted-foreground">
                {service.delivery}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <div className="text-[11px] text-muted-foreground">
                Starting at
              </div>

              <div className="text-base font-bold text-foreground">
                {service.price}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}