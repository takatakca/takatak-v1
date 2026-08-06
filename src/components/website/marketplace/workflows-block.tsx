import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const clientSteps = [
  "Post a project or pick a package",
  "Receive a matched freelancer",
  "Confirm the project scope",
  "Review deliveries and request revisions",
  "Approve the completed work",
];

const freelancerSteps = [
  "Apply to the Groupe TAKATAK roster",
  "Receive matched client briefs",
  "Deliver inside the project workspace",
  "Complete revisions and milestones",
  "Build a verified reputation",
];

function Column({
  tag,
  title,
  items,
  cta,
  href,
}: {
  tag: string;
  title: string;
  items: string[];
  cta: string;
  href: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
        {tag}
      </p>

      <h3 className="mt-2 text-xl font-bold text-slate-950 md:text-2xl">
        {title}
      </h3>

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-sm text-slate-700"
          >
            <CheckCircle2
              size={16}
              className="mt-0.5 shrink-0 text-emerald-700"
            />

            {item}
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"
      >
        {cta}
        <ArrowRight size={14} />
      </Link>
    </article>
  );
}

export function WorkflowsBlock() {
  return (
    <section className="grid gap-5 md:grid-cols-2">
      <Column
        tag="For clients"
        title="A single workspace for every project."
        items={clientSteps}
        cta="Post a project"
        href="/marketplace/post-project"
      />

      <Column
        tag="For freelancers"
        title="Join Groupe TAKATAK and deliver reliably."
        items={freelancerSteps}
        cta="Open freelancer dashboard"
        href="/dashboard/freelancer"
      />
    </section>
  );
}