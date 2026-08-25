"use client";

import { useState } from "react";
import { Link } from "@/lib/website/nav";
import { Sparkles, Loader2 } from "lucide-react";
import { resolveIntent } from "@/lib/website/service-intent";

const EXAMPLES = [
  "Bakery needs logo + Instagram presence",
  "Restaurant menu redesign + online ordering",
  "Local plumber needs Google Maps visibility",
  "Startup needs landing page + brand kit",
];

interface AdvisorRecommendation {
  title: string;
  reason: string;
  cta: { label: string; to: string };
}

interface AdvisorResult {
  source: "fallback";
  summary: string;
  recommendations: AdvisorRecommendation[];
}

function adviseLocally(query: string): AdvisorResult {
  const q = query.toLowerCase();
  const recs: AdvisorRecommendation[] = [];
  const push = (item: AdvisorRecommendation) => {
    if (recs.length < 4) recs.push(item);
  };

  if (/(domain|\.com|\.ca|name)/.test(q)) {
    push({
      title: "Register a domain",
      reason: "Your query mentions a domain name.",
      cta: { label: "Search domains", to: "/domain" },
    });
  }
  if (/(host|server|wordpress|cpanel)/.test(q)) {
    push({
      title: "Web hosting",
      reason: "You'll need managed hosting to run your site.",
      cta: { label: "View plans", to: "/hosting" },
    });
  }
  if (/(website|site|web|landing)/.test(q)) {
    push({
      title: "Website creation",
      reason: "TAKATAK can build your site end-to-end.",
      cta: { label: "Start a website", to: "/services/websites" },
    });
  }
  if (/(logo|brand|design)/.test(q)) {
    push({
      title: "Logo & branding",
      reason: "Get a freelancer-built brand identity via TAKATAK.",
      cta: { label: "Browse logo design", to: "/marketplace/category/logo_design" },
    });
  }
  if (/(seo|google|maps|local|listing|qmaps)/.test(q)) {
    push({
      title: "QMAPS — Local listings",
      reason: "Boost local visibility.",
      cta: { label: "Get QMAPS", to: "/services/local-listings" },
    });
  }
  if (/(lead|prospect|flex)/.test(q)) {
    push({
      title: "FLEXS — Lead generation",
      reason: "Automated lead sourcing.",
      cta: { label: "Get FLEXS", to: "/services/lead-generation" },
    });
  }
  if (/(ai|chatbot|automation|gpt)/.test(q)) {
    push({
      title: "AI business tools",
      reason: "AI-assisted automation for your business.",
      cta: { label: "Explore AI tools", to: "/services/ai-business-tools" },
    });
  }
  if (recs.length === 0) {
    const match = resolveIntent(query);
    push({
      title: match.label,
      reason: "We matched this to the closest TAKATAK service.",
      cta: { label: "Continue", to: match.to },
    });
  }

  return {
    source: "fallback",
    summary: "Here are the TAKATAK services that match your needs.",
    recommendations: recs,
  };
}

export function ServiceAdvisor({ defaultQuery = "" }: { defaultQuery?: string }) {
  const [q, setQ] = useState(defaultQuery);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      setResult(adviseLocally(q));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-10 blur-3xl"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="relative flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary/40">
          <Sparkles size={14} className="text-accent" />
        </span>
        <div>
          <h3 className="font-semibold leading-tight">TAKATAK AI Advisor</h3>
          <p className="text-xs text-muted-foreground">
            Describe what you need — we&apos;ll recommend the right TAKATAK services.
          </p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void run();
          }}
          placeholder="e.g. I run a bakery and need a logo, website, and social posts"
          className="flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Advise
        </button>
      </div>
      {!result && !loading && (
        <div className="relative mt-4">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Try one</div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQ(example)}
                className="rounded-full border border-border bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
      {result && (
        <div className="mt-5 space-y-3">
          <p className="text-sm">{result.summary}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {result.recommendations.map((recommendation, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-background/40 p-3 transition-colors hover:border-primary/40"
              >
                <div className="text-sm font-medium">{recommendation.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{recommendation.reason}</div>
                <Link
                  to={recommendation.cta.to}
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  {recommendation.cta.label} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
