import {
    BadgeCheck,
    Banknote,
    Headphones,
    ShieldCheck,
  } from "lucide-react";
  
  const ITEMS = [
    {
      icon: ShieldCheck,
      title: "Escrow protection",
      description:
        "Payment is held by TAKATAK and released on approval.",
    },
    {
      icon: BadgeCheck,
      title: "Vetted talent",
      description:
        "Every freelancer is screened by Groupe TAKATAK before joining.",
    },
    {
      icon: Headphones,
      title: "Human support",
      description:
        "Real people on standby when a project needs a hand.",
    },
    {
      icon: Banknote,
      title: "Transparent pricing",
      description:
        "Fixed prices and clear scope — no hidden fees.",
    },
  ];
  
  export function TrustBlock() {
    return (
      <section className="brand-dark relative overflow-hidden rounded-2xl border border-white/10 p-6 md:p-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--brand-accent-cyan), var(--brand-accent-violet), transparent)",
          }}
        />
  
        <div className="relative grid grid-cols-2 gap-6 md:grid-cols-4">
          {ITEMS.map((item) => {
            const Icon = item.icon;
  
            return (
              <div key={item.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-primary">
                  <Icon size={18} />
                </div>
  
                <div className="mt-3 font-semibold text-foreground">
                  {item.title}
                </div>
  
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }