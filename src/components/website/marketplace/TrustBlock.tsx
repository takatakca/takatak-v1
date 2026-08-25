import { ShieldCheck, BadgeCheck, Headphones, Banknote } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, t: "Escrow protection", d: "Payment is held by TAKATAK and released on approval." },
  { icon: BadgeCheck, t: "Vetted talent", d: "Every freelancer is screened by Groupe TAKATAK before joining." },
  { icon: Headphones, t: "Human support", d: "Real people on standby when a project needs a hand." },
  { icon: Banknote, t: "Transparent pricing", d: "Fixed prices and clear scope — no hidden fees." },
];

export function TrustBlock() {
  return (
    <section className="brand-dark rounded-2xl border border-white/10 p-6 md:p-8 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand-accent-cyan), var(--brand-accent-violet), transparent)" }}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative">
        {ITEMS.map((i) => {
          const Icon = i.icon;
          return (
            <div key={i.t}>
              <div className="w-10 h-10 rounded-lg bg-white/10 text-primary flex items-center justify-center border border-white/10">
                <Icon size={18} />
              </div>
              <div className="mt-3 font-semibold text-foreground">{i.t}</div>
              <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{i.d}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}