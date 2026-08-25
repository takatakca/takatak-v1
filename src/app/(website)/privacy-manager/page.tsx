import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Manager",
  description:
    "Review the data TAKATAK collects across domains, hosting, marketplace, QMAPS, FLEXS, AI tools and notifications, and exercise your privacy rights.",
};

const services = [
  {
    name: "Domains",
    description:
      "Registrant contact data and DNS configuration handled with our registrar partner.",
  },
  {
    name: "Hosting",
    description:
      "Account and billing data needed to provision and renew managed hosting plans.",
  },
  {
    name: "Service marketplace",
    description:
      "Project briefs, files, messages and order history for marketplace packages.",
  },
  {
    name: "QMAPS — Local listings",
    description:
      "Business profile data published to Google Business, maps and directories on your behalf.",
  },
  {
    name: "FLEXS — Lead generation",
    description:
      "Lead capture forms, outreach lists and campaign analytics.",
  },
  {
    name: "AI tools",
    description:
      "Prompts and uploads processed to deliver AI-assisted business automation.",
  },
  {
    name: "Payments & orders",
    description:
      "Order, invoice and payment status records held for accounting and compliance.",
  },
  {
    name: "Notifications",
    description:
      "Transactional emails and in-app notifications about your services and projects.",
  },
];

const rights = [
  "Access a copy of the personal data we hold about you.",
  "Correct inaccurate or incomplete personal data.",
  "Delete your TAKATAK account and associated personal data, subject to legal retention.",
  "Restrict or object to certain processing activities.",
  "Withdraw consent for marketing communications at any time.",
  "Export your data in a portable, machine-readable format.",
];

export default function PrivacyManagerPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16">
      <header>
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">
          Privacy Manager
        </h1>
        <p className="mt-3 text-muted-foreground">
          TAKATAK is committed to transparency about the data we collect across
          every service we operate. Use this page to understand what is collected
          and how to exercise your privacy rights.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">
          Services and data collected
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <article
              key={service.name}
              className="rounded-xl border border-border bg-card p-5"
            >
              <h3 className="font-semibold text-foreground">{service.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {service.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Your rights</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {rights.map((right) => (
            <li key={right}>{right}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Exercise a privacy right
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Email{" "}
          <a
            href="mailto:support@takatak.ca"
            className="text-primary hover:underline"
          >
            support@takatak.ca
          </a>{" "}
          from the address associated with your TAKATAK account and describe the
          request. We respond within 30 days.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/profile"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Manage account
          </Link>
          <Link
            href="/dashboard/notifications"
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Notification preferences
          </Link>
        </div>
      </section>
    </section>
  );
}
