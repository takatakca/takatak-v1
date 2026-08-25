import { Search, FileSignature, MessageSquare, ShieldCheck } from "lucide-react";

const STEPS = [
  { n: "01", icon: Search, t: "Choose a service or request a custom build", d: "Start with a ready-made TAKATAK package or describe the exact business result you need." },
  { n: "02", icon: FileSignature, t: "Confirm scope, timeline, and budget", d: "We turn your request into a clear project brief with deliverables, milestones, pricing, and approval checkpoints." },
  { n: "03", icon: MessageSquare, t: "Track the work from your dashboard", d: "Your files, messages, milestones, revisions, and delivery updates stay organized in one secure workspace." },
  { n: "04", icon: ShieldCheck, t: "Review, approve, and complete", d: "TAKATAK manages quality control, delivery review, and payment release rules before the project is closed." },
];

export function HowItWorks() {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">How TAKATAK delivers your project</h2>
        <p className="mt-1 text-sm text-muted-foreground">A structured delivery process built for business owners who need reliable execution, clear communication, and professional results.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.n} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-muted-foreground">{s.n}</div>
                <Icon size={18} className="text-primary" />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">{s.t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}