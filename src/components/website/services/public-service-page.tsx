import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import type { PublicServiceDefinition } from "@/lib/website/public-services";

const timeline = [
  "Request received",
  "Scope confirmed",
  "Payment or approval",
  "Service setup",
  "Dashboard delivery",
];

export function PublicServicePage({
  service,
}: {
  service: PublicServiceDefinition;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
          <Sparkles
            size={12}
            className="text-emerald-700"
          />

          {service.status === "live"
            ? "Live service"
            : "Beta"}
        </span>

        <h1 className="mt-5 text-4xl font-bold text-slate-950 md:text-5xl">
          {service.title}
        </h1>

        <p className="mt-4 text-lg leading-8 text-slate-600">
          {service.longDescription}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/register?next=${encodeURIComponent(
              service.dashboardRoute,
            )}`}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500"
          >
            {service.ctaLabel}
            <ArrowRight size={16} />
          </Link>

          <Link
            href={service.dashboardRoute}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Open dashboard
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            How it works
          </h2>

          <div className="mt-5 space-y-3">
            {timeline.map(
              (item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">
                    {index + 1}
                  </span>

                  <span className="text-sm font-medium text-slate-700">
                    {item}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            What you get
          </h2>

          <ul className="mt-5 space-y-3 text-sm text-slate-600">
            {[
              "Structured service intake",
              "Clear project or provisioning status",
              "Live status inside the TAKATAK dashboard",
              "TAKATAK support for exceptions",
              "Organized billing and delivery history",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2"
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
            href={service.dashboardRoute}
            className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"
          >
            Open dashboard
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}