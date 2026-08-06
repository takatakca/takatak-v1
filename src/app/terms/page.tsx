import Link from "next/link";

export const metadata = {
  title: "Terms of Service — TAKATAK Dashboard",
  description:
    "Terms governing access to the TAKATAK User Official Dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-slate-200 pb-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white">
            T
          </span>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            Terms of Service
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Effective date: July 28, 2026
          </p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              1. Acceptance of these Terms
            </h2>

            <p className="mt-2">
              These Terms govern your access to and use of the
              TAKATAK User Official Dashboard. By creating an
              account, accessing the dashboard, or using its
              services, you agree to these Terms and the Privacy
              Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              2. Account eligibility
            </h2>

            <p className="mt-2">
              You must provide accurate, current, and complete
              registration information. You must have the legal
              authority to create an account for yourself or the
              organization you represent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              3. Account security
            </h2>

            <p className="mt-2">
              You are responsible for protecting your password,
              maintaining the confidentiality of your account, and
              notifying TAKATAK promptly of suspected unauthorized
              access. You may not share login credentials with an
              unauthorized person.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              4. Email verification
            </h2>

            <p className="mt-2">
              New accounts may require email verification before
              dashboard access is granted. TAKATAK may suspend or
              reject accounts containing false, incomplete, abusive,
              or unverifiable information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              5. Permitted use
            </h2>

            <p className="mt-2">
              You may use the dashboard only for lawful business and
              account-management purposes. You must comply with all
              applicable laws, contractual obligations, and
              third-party platform requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              6. Prohibited activity
            </h2>

            <p className="mt-2">
              You may not attempt to bypass security controls, access
              another user&apos;s data, upload malicious code,
              interfere with dashboard operation, misuse integrations,
              impersonate another person, scrape protected data, or
              use the platform for fraudulent or unlawful activity.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              7. Client data and content
            </h2>

            <p className="mt-2">
              You retain ownership of information and content you
              submit. You grant TAKATAK permission to process that
              information only as required to operate, secure,
              maintain, support, and improve the services requested
              through your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              8. Third-party services
            </h2>

            <p className="mt-2">
              Some dashboard features may connect with third-party
              services. Those services remain governed by their own
              terms, privacy policies, availability, pricing, and
              technical limitations. TAKATAK does not control
              third-party platforms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              9. Service availability
            </h2>

            <p className="mt-2">
              TAKATAK may perform maintenance, security updates, or
              service changes. Temporary interruptions may occur.
              TAKATAK does not guarantee uninterrupted or error-free
              availability.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              10. Suspension and termination
            </h2>

            <p className="mt-2">
              TAKATAK may restrict, suspend, or terminate access when
              necessary to protect users, investigate misuse, enforce
              these Terms, comply with legal obligations, or address
              unpaid services governed by a separate agreement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              11. Disclaimer
            </h2>

            <p className="mt-2">
              The dashboard is provided on an available basis.
              Information displayed by integrations may depend on
              third-party systems and may be delayed, incomplete, or
              unavailable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              12. Limitation of liability
            </h2>

            <p className="mt-2">
              To the maximum extent permitted by applicable law,
              TAKATAK will not be responsible for indirect,
              incidental, special, consequential, or punitive damages
              arising from dashboard use, service interruption,
              unauthorized access caused by user negligence, or
              third-party platform failure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              13. Governing law
            </h2>

            <p className="mt-2">
              These Terms are governed by the applicable laws of
              Québec and Canada, without limiting any mandatory
              consumer or privacy rights that apply to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              14. Changes to these Terms
            </h2>

            <p className="mt-2">
              TAKATAK may update these Terms when services, legal
              requirements, or security practices change. The updated
              effective date will appear on this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              15. Contact
            </h2>

            <p className="mt-2">
              Questions concerning these Terms may be submitted
              through the official TAKATAK support channel associated
              with your account.
            </p>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm">
          <Link
            href="/register"
            className="font-semibold text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Return to registration
          </Link>

          <Link
            href="/privacy"
            className="font-semibold text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Privacy Policy
          </Link>
        </footer>
      </article>
    </main>
  );
}