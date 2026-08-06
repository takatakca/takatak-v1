import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
} from "lucide-react";

export function FinalCtaSection() {
  return (
    <section className="brand-dark relative overflow-hidden border-t border-border">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(700px 300px at 50% -20%, color-mix(in oklab, var(--brand-accent-cyan) 22%, transparent), transparent 60%), radial-gradient(700px 300px at 50% 120%, color-mix(in oklab, var(--brand-accent-violet) 22%, transparent), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-foreground/85">
          <Sparkles
            size={12}
            className="text-primary"
          />

          TAKATAK operating platform
        </span>

        <h2 className="mt-5 text-3xl font-bold leading-tight text-foreground md:text-5xl">
          Ready to build your online
          business system?
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          Bring your domain, hosting,
          website, marketing, and delivery
          workflows into one dashboard —
          with real humans behind every
          project.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-primary-foreground"
            style={{
              backgroundImage:
                "var(--gradient-hero)",
            }}
          >
            Explore services
            <ArrowRight size={16} />
          </Link>

          <Link
            href="/marketplace/post-project"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-foreground hover:bg-white/10"
          >
            Start a project
          </Link>
        </div>
      </div>
    </section>
  );
}