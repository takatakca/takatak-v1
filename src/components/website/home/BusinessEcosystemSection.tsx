import { Link } from "@/lib/website/nav";
import { ArrowRight, Bot, Globe2, MapPin, Megaphone, PhoneCall, Server, Smartphone, Sparkles, Users } from "lucide-react";

const secondaryServices = [
  { title: "Mobile Apps", to: "/services/mobile-apps", icon: Smartphone, chips: ["iOS", "Android", "Dashboards"] },
  { title: "Marketing", to: "/services/marketing", icon: Megaphone, chips: ["Campaigns", "Funnels", "Tracking"] },
  { title: "Social Automation", to: "/services/social-media", icon: Sparkles, chips: ["Planning", "Publishing", "Content"] },
  { title: "Local Visibility / QMAPS", to: "/services/local-listings", icon: MapPin, chips: ["Maps", "Reviews", "Listings"] },
  { title: "Lead Generation / FLEXS", to: "/services/lead-generation", icon: Users, chips: ["Prospects", "Routing", "CRM"] },
  { title: "VoIP", to: "/services/voip", icon: PhoneCall, chips: ["Numbers", "IVR", "Call flow"] },
  { title: "AI-Assisted Business Tools", to: "/services/ai-business-tools", icon: Bot, chips: ["Agents", "Parsing", "Ops"] },
] as const;

function Chip({ children }: { children: string }) {
  return <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{children}</span>;
}

export function BusinessEcosystemSection() {
  return (
    <section className="relative overflow-hidden bg-secondary/35 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.82fr)_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Business infrastructure</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-foreground md:text-5xl">
              Build your online business infrastructure with TAKATAK
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
              Domains, hosting, websites, marketing, local visibility, lead generation, communications, and managed service delivery — connected in one professional platform.
            </p>
          </div>
          <Link to="/services/marketplace" className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background hover:opacity-90">
            Explore business services <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Link to="/domain" className="group overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:border-primary/45 hover:-translate-y-0.5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Domain Names</p>
                <h3 className="mt-3 text-2xl font-bold text-foreground">Secure the name your customers remember</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Search, request, and prepare domains for DNS, email, websites, and hosting inside the TAKATAK flow.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['.ca', '.com', '.net', 'Québec business'].map((c) => <Chip key={c}>{c}</Chip>)}
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Search domains <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
              </div>
              <div className="rounded-2xl border border-border bg-secondary p-4">
                <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground">
                    <Globe2 size={16} className="text-primary" /> yourbrand.ca
                  </div>
                  <div className="mt-4 space-y-2">
                    {['Availability check', 'DNS profile', 'Email-ready'].map((x) => <div key={x} className="h-2 rounded-full bg-primary/20" />)}
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/hosting" className="group overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:border-primary/45 hover:-translate-y-0.5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Web Hosting</p>
                <h3 className="mt-3 text-2xl font-bold text-foreground">Hosting built for launch, email, and growth</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">WordPress-ready plans with SSL, email, cPanel, backups, and TAKATAK-managed support paths.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['WordPress', 'cPanel', 'SSL', 'Email'].map((c) => <Chip key={c}>{c}</Chip>)}
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">View hosting plans <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
              </div>
              <div className="rounded-2xl border border-border bg-secondary p-4">
                <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2"><Server size={17} className="text-primary" /><span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">Live</span></div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[62, 78, 46].map((h) => <div key={h} className="rounded-md bg-primary/15" style={{ height: `${h}px` }} />)}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/services/websites" className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary/40 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Website Creation</p>
            <h3 className="mt-3 text-xl font-bold text-foreground">Custom sites that connect brand, offer, content, and conversion</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">TAKATAK structures the brief, design, pages, launch path, and delivery workspace.</p>
            <div className="mt-4 flex flex-wrap gap-2">{['Brand system', 'Conversion pages', 'Managed launch'].map((c) => <Chip key={c}>{c}</Chip>)}</div>
          </Link>
          <Link to="/marketplace" className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary/40 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Marketplace Services</p>
            <h3 className="mt-3 text-xl font-bold text-foreground">Vetted execution for logos, content, tech, data, and growth work</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Browse fixed packages or post a custom project with TAKATAK-managed approvals.</p>
            <div className="mt-4 flex flex-wrap gap-2">{['Escrow', 'Milestones', 'Review'].map((c) => <Chip key={c}>{c}</Chip>)}</div>
          </Link>
          {secondaryServices.map((service) => {
            const Icon = service.icon;
            return (
              <Link key={service.title} to={service.to} className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Icon size={18} /></div>
                  <ArrowRight size={15} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{service.title}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">{service.chips.map((c) => <Chip key={c}>{c}</Chip>)}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}