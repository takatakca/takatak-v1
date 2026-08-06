import type { LucideIcon } from "lucide-react";
import {
  Headphones,
  Layers,
  Leaf,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";

const pillars: ReadonlyArray<{
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    icon: ShieldCheck,
    title: "Managed delivery",
    description:
      "Every project is scoped, tracked, and delivered inside your TAKATAK workspace — no chasing freelancers by email.",
  },
  {
    icon: Users,
    title: "Human review",
    description:
      "TAKATAK reviews milestones and approvals before funds are released, so quality never rides on a single review.",
  },
  {
    icon: Lock,
    title: "Secure dashboard",
    description:
      "Encrypted account, protected checkout, secure file exchange, and access controls on every project.",
  },
  {
    icon: Leaf,
    title: "Canadian focus",
    description:
      "Local support, CAD billing, and Canadian business context built into intake, hosting, and marketing services.",
  },
  {
    icon: Layers,
    title: "Scalable services",
    description:
      "Start with a domain or a logo, then add hosting, apps, marketing, and automation from the same dashboard.",
  },
  {
    icon: Headphones,
    title: "Real support",
    description:
      "Human account support for exceptions, escalations, and hand-offs — not just a chatbot on a marketing page.",
  },
];

export function WhyTakatakSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Why TAKATAK
          </p>

          <h2 className="mt-3 text-3xl font-bold leading-tight text-foreground md:text-4xl">
            A serious platform for people
            who need their business to work
          </h2>

          <p className="mt-3 text-base leading-7 text-muted-foreground">
            We combine software, human
            review, and Canadian support so
            you can run every online service
            in one professional workspace.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <div
                key={pillar.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>

                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {pillar.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}