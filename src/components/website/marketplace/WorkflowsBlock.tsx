import { Link } from "@/lib/website/nav";
import { CheckCircle2, ArrowRight } from "lucide-react";

const CLIENT = [
  "Post a project or pick a package",
  "Receive matched freelancer in 24h",
  "Fund the milestone — held in escrow",
  "Review deliveries and request revisions",
  "Approve to release payment",
];

const FREELANCER = [
  "Apply to join the Groupe TAKATAK roster",
  "Get matched with vetted client briefs",
  "Deliver in the project workspace",
  "Get paid automatically on approval",
  "Build a verified reputation",
];

export function WorkflowsBlock() {
  return (
    <section className="grid md:grid-cols-2 gap-5">
      <Column
        tag="For clients"
        title="A single workspace for every project."
        items={CLIENT}
        cta="Post a project"
        href="/marketplace/post-project"
      />
      <Column
        tag="For freelancers"
        title="Join Groupe TAKATAK and get paid reliably."
        items={FREELANCER}
        cta="Become a freelancer"
        href="/marketplace/post-project"
      />
    </section>
  );
}

function Column({
  tag, title, items, cta, href,
}: { tag: string; title: string; items: string[]; cta: string; href: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">{tag}</div>
      <h3 className="mt-2 text-xl md:text-2xl font-bold text-foreground">{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
            <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
            <span>{i}</span>
          </li>
        ))}
      </ul>
      <Link
        to={href}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        {cta} <ArrowRight size={14} />
      </Link>
    </div>
  );
}