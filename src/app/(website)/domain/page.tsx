import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Globe2,
  LockKeyhole,
  Mail,
  Server,
} from "lucide-react";

import { UpmindDomainSearch } from "@/components/website/domain/upmind-domain-search";

export const metadata: Metadata = {
  title: "Domain Names — TAKATAK",
};

export default function DomainPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-[#090a1a] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <Globe2
                size={14}
                className="text-emerald-400"
              />

              TAKATAK registrar desk
            </div>

            <h1 className="mt-5 max-w-xl text-4xl font-bold leading-tight md:text-6xl">
              Find your perfect domain
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
              Secure the name, DNS, email
              readiness, and hosting path for your
              business with a managed TAKATAK
              registration flow.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3 text-sm">
              {[
                ".ca domains",
                "DNS setup",
                "Email-ready",
                "Managed by TAKATAK",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                >
                  <CheckCircle2
                    size={15}
                    className="text-emerald-400"
                  />

                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-3 text-slate-950 shadow-2xl sm:p-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Live domain desk
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Search and register
              </h2>

              <div className="mt-5">
                <UpmindDomainSearch />
              </div>
            </div>

            <div className="grid gap-3 px-2 pt-4 text-xs text-slate-500 sm:grid-cols-3">
              <span className="inline-flex items-center gap-2">
                <LockKeyhole
                  size={14}
                  className="text-emerald-700"
                />

                Protected account flow
              </span>

              <span className="inline-flex items-center gap-2">
                <Mail
                  size={14}
                  className="text-emerald-700"
                />

                Email setup ready
              </span>

              <span className="inline-flex items-center gap-2">
                <Server
                  size={14}
                  className="text-emerald-700"
                />

                Hosting compatible
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3">
        <Link
          href="/hosting"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-500"
        >
          <p className="font-semibold text-slate-950">
            Bundle with hosting
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Connect your domain to WordPress,
            SSL, cPanel, and email.
          </p>
        </Link>

        <Link
          href="/services/websites"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-500"
        >
          <p className="font-semibold text-slate-950">
            Launch a website
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Turn the new domain into a
            professional TAKATAK build.
          </p>
        </Link>

        <Link
          href="/dashboard/support"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-500"
        >
          <p className="font-semibold text-slate-950">
            Need help choosing?
          </p>

          <p className="mt-1 text-sm text-slate-600">
            TAKATAK can review names before
            registration.
          </p>
        </Link>
      </section>
    </>
  );
}