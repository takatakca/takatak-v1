"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { REVIEW_SOURCES, type ReviewSource } from "@/lib/reputation/sources";

const CATEGORIES = [
  { id: "all", label: "All sources" },
  { id: "native_v1", label: "Native workflows" },
  { id: "counterpart_api", label: "Partner APIs" },
  { id: "provider_approval", label: "Provider approval" },
  { id: "social_module", label: "Social workspace" },
] as const;
const DELIVERY_LABELS: Record<ReviewSource["delivery"], string> = {
  native_v1: "Built into TAKATAK",
  counterpart_api: "API handoff requested",
  provider_approval: "Provider approval required",
  social_module: "Managed in Social",
};

/** Capability directory, never a claim that a tenant has connected an account. */
export function ReviewSourceDirectory() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const sources = REVIEW_SOURCES.filter(
    (source) =>
      (category === "all" || source.delivery === category) &&
      `${source.name} ${source.read}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <Card className="overflow-hidden">
      <section aria-label="Review source directory">
        <CardHeader
          title="Your review ecosystem"
          subtitle="Find a source, explore its capabilities, and open the right TAKATAK workspace."
        />
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="relative w-full sm:max-w-sm">
              <span className="sr-only">Find a review platform</span>
              <Search
                aria-hidden
                className="absolute left-3 top-3 h-4 w-4 text-slate-500"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find Google, QMAPS, FLEXS…"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              />
            </label>
            <p role="status" className="text-xs text-slate-500">
              {sources.length} of {REVIEW_SOURCES.length} sources
            </p>
          </div>
          <div
            role="group"
            aria-label="Source workflow category"
            className="mt-4 flex flex-wrap gap-2"
          >
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${category === item.id ? "border-[#1565D8] bg-[#1565D8] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            These are platform capabilities. Account connections and permissions
            are checked separately in each workspace.
          </p>
        </CardBody>
        <div className="grid gap-px border-t border-slate-100 bg-slate-100 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <article key={source.id} className="flex flex-col bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                {source.name}
              </h3>
              <div className="mt-2">
                <Badge>{DELIVERY_LABELS[source.delivery]}</Badge>
              </div>
              <p className="mt-3 flex-1 text-xs leading-6 text-slate-600">
                {source.read}
              </p>
              <details className="mt-3 text-xs leading-6 text-slate-600">
                <summary className="cursor-pointer rounded font-medium text-[#1565D8] focus-visible:outline-2 focus-visible:outline-blue-600">
                  Response and publishing details
                </summary>
                <p className="mt-2">{source.reply}</p>
                <p className="mt-2">{source.publication}</p>
                <a
                  href={source.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-medium text-[#1565D8]"
                >
                  API reference for {source.name}
                  <ArrowUpRight aria-hidden className="h-3 w-3" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </details>
              <Link
                href={source.route}
                className="mt-4 inline-flex items-center gap-1 self-start rounded text-xs font-semibold text-[#1565D8] focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Open {source.name} workspace{" "}
                <ArrowUpRight aria-hidden className="h-3 w-3" />
              </Link>
            </article>
          ))}
        </div>
        {!sources.length && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">
              No matching platforms
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Try another name or reset the source filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
              className="mt-4 rounded-lg bg-[#1565D8] px-4 py-2 text-xs font-semibold text-white"
            >
              Reset source filters
            </button>
          </div>
        )}
      </section>
    </Card>
  );
}
