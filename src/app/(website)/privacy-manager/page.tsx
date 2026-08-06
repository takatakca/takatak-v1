import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "Privacy Manager — TAKATAK",
  description:
    "Review the data TAKATAK uses across its services and exercise your privacy rights.",
};

const services = [
  {
    name: "Domains",
    description:
      "Registrant contact data and DNS configuration required to manage domain services.",
  },
  {
    name: "Hosting",
    description:
      "Account, technical, and billing information required to provision and renew hosting.",
  },
  {
    name: "Service marketplace",
    description:
      "Project briefs, files, messages, selections, and project history.",
  },
  {
    name: "QMAPS",
    description:
      "Business profile, location, listing, and visibility information.",
  },
  {
    name: "FLEXS",
    description:
      "Lead forms, lead-routing details, campaign information, and related analytics.",
  },
  {
    name: "AI tools",
    description:
      "Prompts and approved files processed to provide requested AI-assisted services.",
  },
  {
    name: "Payments and orders",
    description:
      "Order, invoice, discount, payment-status, and accounting records.",
  },
  {
    name: "Notifications",
    description:
      "Transactional messages and notification preferences related to your account.",
  },
];

const rights = [
  "Access a copy of the personal information TAKATAK holds about you.",
  "Correct inaccurate or incomplete personal information.",
  "Request account deletion, subject to legal retention requirements.",
  "Restrict or object to certain processing activities.",
  "Withdraw consent for optional marketing communications.",
  "Request an export of supported account information.",
];

export default function PrivacyManagerPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16">
      <header>
        <h1 className="text-3xl font-bold text-slate-950 md:text-4xl">
          Privacy Manager
        </h1>

        <p className="mt-3 leading-7 text-slate-600">
          TAKATAK is committed to transparency
          about information used across its
          services. This page explains the main
          categories and how to exercise a
          privacy right.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-950">
          Services and information used
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <article
              key={service.name}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <h3 className="font-semibold text-slate-950">
                {service.name}
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                {service.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-950">
          Your rights
        </h2>

        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          {rights.map((right) => (
            <li key={right}>
              {right}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">
          Exercise a privacy right
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          Email{" "}
          <a
            href="mailto:support@takatak.ca"
            className="font-medium text-emerald-700"
          >
            support@takatak.ca
          </a>{" "}
          from the email address associated with
          your account and describe your
          request.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/account"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Manage account
          </Link>

          <Link
            href="/dashboard/notifications"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Notification preferences
          </Link>
        </div>
      </section>
    </section>
  );
}