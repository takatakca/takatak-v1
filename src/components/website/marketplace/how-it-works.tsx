import {
    FileSignature,
    MessageSquare,
    Search,
    ShieldCheck,
  } from "lucide-react";
  
  const steps = [
    {
      number: "01",
      icon: Search,
      title:
        "Choose a service or request a custom build",
      description:
        "Start with a ready-made TAKATAK package or describe the exact business result you need.",
    },
    {
      number: "02",
      icon: FileSignature,
      title:
        "Confirm scope, timeline, and budget",
      description:
        "We turn your request into a clear project brief with deliverables, milestones, pricing, and approval checkpoints.",
    },
    {
      number: "03",
      icon: MessageSquare,
      title:
        "Track the work from your dashboard",
      description:
        "Files, messages, milestones, revisions, and delivery updates stay organized in one secure workspace.",
    },
    {
      number: "04",
      icon: ShieldCheck,
      title:
        "Review, approve, and complete",
      description:
        "TAKATAK manages quality control, delivery review, and payment-release rules before the project closes.",
    },
  ];
  
  export function HowItWorks() {
    return (
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-950 md:text-3xl">
            How TAKATAK delivers your project
          </h2>
  
          <p className="mt-1 text-sm text-slate-600">
            A structured delivery process built for
            business owners who need reliable
            execution and clear communication.
          </p>
        </div>
  
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => {
            const Icon = step.icon;
  
            return (
              <article
                key={step.number}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-500">
                    {step.number}
                  </span>
  
                  <Icon
                    size={18}
                    className="text-emerald-700"
                  />
                </div>
  
                <h3 className="mt-4 font-semibold text-slate-950">
                  {step.title}
                </h3>
  
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    );
  }