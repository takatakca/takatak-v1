import { Check, Sparkles } from "lucide-react";
import { PROMO_CODE } from "@/lib/website/promotions";

const BENEFITS = [
  "Project dashboard",
  "Secure order tracking",
  "Service marketplace access",
  "Domain and hosting tools",
  "QMAPS and FLEXS access",
  "Notifications and support",
];

export function SignupPromoPanel() {
  return (
    <aside className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-6">
      <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-primary">
        <Sparkles size={14} /> New client offer
      </div>
      <h2 className="mt-2 text-xl md:text-2xl font-bold text-foreground">
        Claim 10% off your first TAKATAK service
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create your account, verify your email or phone, and your first-service discount will be available in your dashboard.
      </p>
      <div className="mt-4 rounded-lg border border-dashed border-primary/40 bg-card px-4 py-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Promo code</span>
        <span className="font-mono font-semibold text-foreground">{PROMO_CODE}</span>
      </div>
      <ul className="mt-5 space-y-2">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-center gap-2 text-sm text-foreground/90">
            <Check size={15} className="text-primary shrink-0" />
            {b}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] text-muted-foreground">
        One discount per new client. Applies to your first eligible TAKATAK service order; final totals are calculated at checkout.
      </p>
    </aside>
  );
}