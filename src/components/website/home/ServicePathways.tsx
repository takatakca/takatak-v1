import { Link } from "@/lib/website/nav";
import { ArrowRight, Globe2, Server, Rocket, Megaphone, Store, Workflow } from "lucide-react";
import { formatCAD, cadenceLabel, pricing } from "@/lib/website/pricing";

const pathways = [
  { title: "Domains",     desc: "Find and register your name.",     to: "/domain",   icon: Globe2,   from: pricing.domain.register.amount, cadence: "yearly" as const },
  { title: "Hosting",     desc: "Fast, managed, backed up.",         to: "/hosting",  icon: Server,   from: pricing.hosting[0].amount,      cadence: "monthly" as const },
  { title: "Websites",    desc: "Designed and built for you.",       to: "/services/websites", icon: Rocket, from: pricing.websites[0].amount, cadence: "one-time" as const },
  { title: "Marketing",   desc: "Campaigns that bring customers.",   to: "/services/marketing", icon: Megaphone, from: pricing.marketing[0].amount, cadence: "one-time" as const },
  { title: "Marketplace", desc: "Hire vetted specialists.",          to: "/marketplace", icon: Store, from: pricing.design[0].amount,      cadence: "one-time" as const },
  { title: "Automation",  desc: "Put your operations on rails.",     to: "/services/ai-business-tools", icon: Workflow, from: pricing.ai[0].amount, cadence: "one-time" as const },
];

export function ServicePathways() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 md:py-20">
      <h2 className="text-2xl font-bold text-foreground md:text-3xl">Where do you want to start?</h2>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pathways.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.title}
              to={p.to as never}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/45"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-foreground">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-foreground">
                  {formatCAD(p.from)}
                  <span className="text-xs font-medium text-muted-foreground">{cadenceLabel(p.cadence)}</span>
                </div>
                <ArrowRight size={14} className="ml-auto mt-1 text-primary transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link to="/services" className="font-semibold text-primary hover:underline">All services</Link>
        <span className="text-border">·</span>
        <Link to="/pricing" className="font-semibold text-primary hover:underline">Full pricing</Link>
      </div>
    </section>
  );
}
