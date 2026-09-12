import { Link } from "@/lib/website/nav";
import { brand } from "@/lib/website/brand";
import { TakatakLogo } from "@/components/brand/takatak-logo";

const cols = [
  {
    title: "Categories",
    links: [
      { to: "/marketplace/category/$slug", params: { slug: "logo_design" }, label: "Graphics & Design" },
      { to: "/marketplace/category/$slug", params: { slug: "website_design" }, label: "Programming & Tech" },
      { to: "/marketplace/category/$slug", params: { slug: "online_advertising" }, label: "Digital Marketing" },
      { to: "/marketplace/category/$slug", params: { slug: "content_writing" }, label: "Writing & Translation" },
      { to: "/marketplace/category/$slug", params: { slug: "ai_tool_setup" }, label: "AI Services" },
      { to: "/marketplace/category/$slug", params: { slug: "data_entry" }, label: "Data" },
    ],
  },
  {
    title: "For Clients",
    links: [
      { to: "/marketplace", label: "How TAKATAK works" },
      { to: "/marketplace/post-project", label: "Post a project" },
      { to: "/dashboard/marketplace", label: "Manage projects" },
      { to: "/dashboard/support", label: "Support" },
    ],
  },
  {
    title: "For Groupe TAKATAK Freelancers",
    links: [
      { to: "/dashboard/freelancer", label: "Become a freelancer" },
      { to: "/dashboard/freelancer/contracts", label: "Contracts" },
      { to: "/dashboard/freelancer/deliveries", label: "Deliveries" },
      { to: "/dashboard/freelancer/payouts", label: "Payouts" },
    ],
  },
  {
    title: "Business Solutions",
    links: [
      { to: "/domain", label: "Domains" },
      { to: "/hosting", label: "Hosting" },
      { to: "/services/local-listings", label: "Local Visibility" },
      { to: "/services/lead-generation", label: "Lead Generation" },
      { to: "/services/ai-business-tools", label: "AI Tools" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/", label: "About TAKATAK" },
      { to: "/deals", label: "Today's Deals" },
      { to: "/login", label: "Sign in" },
      { to: "/register", label: "Get started" },
      { to: "/privacy-manager", label: "Privacy manager" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="brand-dark border-t border-border mt-24 relative">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand-accent-cyan), var(--brand-accent-violet), transparent)" }}
      />
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          <div className="col-span-2 md:col-span-1">
            <h3 className="flex items-center gap-1.5">
              <TakatakLogo />
            </h3>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              {brand.positioning}
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              {brand.supportEmail}
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-4">{col.title}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.links.map((l) => {
                  const linkProps = "params" in l && l.params
                    ? { to: l.to, params: l.params as never }
                    : { to: l.to };
                  return (
                    <li key={`${col.title}-${l.label}`}>
                      <Link {...linkProps} className="hover:text-foreground transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-12 pt-8 flex flex-col sm:flex-row gap-3 justify-between text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {brand.legalName}. {brand.domain}</p>
          <p>Managed online services for growing businesses.</p>
        </div>
      </div>
    </footer>
  );
}