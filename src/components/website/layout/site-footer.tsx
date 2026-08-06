import Link from "next/link";

import { brand } from "@/lib/website/brand";

const columns = [
  {
    title: "Categories",
    links: [
      {
        href: "/marketplace/category/logo_design",
        label: "Graphics & Design",
      },
      {
        href: "/marketplace/category/website_design",
        label: "Programming & Tech",
      },
      {
        href: "/marketplace/category/online_advertising",
        label: "Digital Marketing",
      },
      {
        href: "/marketplace/category/content_writing",
        label: "Writing & Translation",
      },
      {
        href: "/marketplace/category/ai_tool_setup",
        label: "AI Services",
      },
      {
        href: "/marketplace/category/data_entry",
        label: "Data",
      },
    ],
  },
  {
    title: "For Clients",
    links: [
      {
        href: "/marketplace",
        label: "How TAKATAK works",
      },
      {
        href: "/marketplace/post-project",
        label: "Post a project",
      },
      {
        href: "/dashboard/marketplace",
        label: "Manage projects",
      },
      {
        href: "/dashboard/support",
        label: "Support",
      },
    ],
  },
  {
    title:
      "For Groupe TAKATAK Freelancers",
    links: [
      {
        href: "/dashboard/freelancer",
        label: "Become a freelancer",
      },
      {
        href: "/dashboard/freelancer/contracts",
        label: "Contracts",
      },
      {
        href: "/dashboard/freelancer/deliveries",
        label: "Deliveries",
      },
      {
        href: "/dashboard/freelancer/payouts",
        label: "Payouts",
      },
    ],
  },
  {
    title: "Business Solutions",
    links: [
      {
        href: "/domain",
        label: "Domains",
      },
      {
        href: "/hosting",
        label: "Hosting",
      },
      {
        href: "/services/local-listings",
        label: "QMAPS",
      },
      {
        href: "/services/lead-generation",
        label: "FLEXS",
      },
      {
        href: "/services/ai-business-tools",
        label: "AI Tools",
      },
    ],
  },
  {
    title: "Company",
    links: [
      {
        href: "/",
        label: "About TAKATAK",
      },
      {
        href: "/deals",
        label: "Today's Deals",
      },
      {
        href: "/login",
        label: "Sign in",
      },
      {
        href: "/register",
        label: "Get started",
      },
      {
        href: "/privacy-manager",
        label: "Privacy manager",
      },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="brand-dark relative mt-24 border-t border-border">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--brand-accent-cyan), var(--brand-accent-violet), transparent)",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 md:col-span-1">
            <h3 className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold tracking-tight text-foreground">
                {brand.brandName}
              </span>

              <span
                className="mt-2.5 h-1.5 w-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
            </h3>

            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              {brand.positioning}
            </p>

            <p className="mt-6 text-xs text-muted-foreground">
              {brand.supportEmail}
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="mb-4 text-sm font-semibold">
                {column.title}
              </h4>

              <ul className="space-y-2 text-sm text-muted-foreground">
                {column.links.map(
                  (link) => (
                    <li
                      key={`${column.title}-${link.label}`}
                    >
                      <Link
                        href={link.href}
                        className="transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col justify-between gap-3 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()}{" "}
            {brand.legalName}.{" "}
            {brand.domain}
          </p>

          <p>
            Managed online services for
            growing businesses.
          </p>
        </div>
      </div>
    </footer>
  );
}