import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — TAKATAK Dashboard",
  description:
    "Privacy practices for the TAKATAK User Official Dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-slate-200 pb-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white">
            T
          </span>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            Privacy Policy
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Effective date: July 28, 2026
          </p>
        </header>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              1. Scope
            </h2>

            <p className="mt-2">
              This Privacy Policy explains how TAKATAK collects,
              uses, stores, protects, and discloses personal
              information connected with the TAKATAK User Official
              Dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              2. Information we collect
            </h2>

            <p className="mt-2">
              We may collect the following information:
            </p>

            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>First name and last name.</li>
              <li>Email address.</li>
              <li>Supabase authentication user identifier.</li>
              <li>Account role, status, and client memberships.</li>
              <li>Business and service information submitted through the dashboard.</li>
              <li>Login, session, security, and audit information.</li>
              <li>IP address, browser information, and device information when required for security.</li>
              <li>Support communications and account requests.</li>
            </ul>

            <p className="mt-3">
              Passwords are processed through Supabase Authentication.
              TAKATAK does not store readable account passwords in
              the application database.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              3. How information is collected
            </h2>

            <p className="mt-2">
              Information may be collected when you register, verify
              your email, sign in, update your profile, use dashboard
              services, communicate with support, or interact with
              connected services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              4. Why we use information
            </h2>

            <p className="mt-2">
              Personal information may be used to:
            </p>

            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Create, verify, and manage your account.</li>
              <li>Authenticate users and maintain secure sessions.</li>
              <li>Provide access based on account role and client membership.</li>
              <li>Deliver requested dashboard services.</li>
              <li>Send account verification and security emails.</li>
              <li>Respond to support requests.</li>
              <li>Prevent fraud, abuse, and unauthorized access.</li>
              <li>Maintain security logs and investigate incidents.</li>
              <li>Comply with applicable legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              5. Consent
            </h2>

            <p className="mt-2">
              By registering and using the dashboard, you consent to
              the collection, use, and disclosure of information as
              described in this Policy.
            </p>

            <p className="mt-2">
              Where consent is legally required, you may withdraw it,
              subject to legal, security, contractual, and operational
              restrictions. Withdrawal may prevent continued use of
              some dashboard services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              6. Service providers
            </h2>

            <p className="mt-2">
              TAKATAK may use service providers to operate the
              dashboard, including:
            </p>

            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Supabase for authentication and database services.</li>
              <li>Maileroo for transactional email delivery.</li>
              <li>Website hosting and infrastructure providers.</li>
              <li>Monitoring, security, and technical-support providers.</li>
              <li>Connected business services authorized through your account.</li>
            </ul>

            <p className="mt-3">
              Providers receive only the information reasonably
              required to perform their services and remain subject
              to applicable contractual and security obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              7. Disclosure of information
            </h2>

            <p className="mt-2">
              TAKATAK does not sell personal information.
            </p>

            <p className="mt-2">
              Information may be disclosed to authorized service
              providers, account administrators, legal authorities,
              or other parties when required to provide services,
              protect users, investigate misuse, enforce agreements,
              or comply with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              8. Cookies and sessions
            </h2>

            <p className="mt-2">
              The dashboard uses authentication cookies and similar
              technologies required to maintain secure sessions,
              remember authentication state, prevent unauthorized
              access, and operate protected pages.
            </p>

            <p className="mt-2">
              Disabling required authentication cookies may prevent
              access to the dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              9. Information security
            </h2>

            <p className="mt-2">
              TAKATAK applies administrative, technical, and
              organizational safeguards appropriate to the
              sensitivity of the information being processed.
            </p>

            <p className="mt-2">
              These safeguards may include encrypted connections,
              password hashing through the authentication provider,
              role-based access controls, tenant isolation, protected
              sessions, audit records, restricted database access,
              validation, and security monitoring.
            </p>

            <p className="mt-2">
              No electronic system can guarantee absolute security.
              Users must protect their passwords and report suspected
              unauthorized access promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              10. Retention
            </h2>

            <p className="mt-2">
              Personal information is retained only for as long as
              reasonably required to operate the account, provide
              requested services, maintain security records, resolve
              disputes, enforce agreements, and satisfy legal
              obligations.
            </p>

            <p className="mt-2">
              Information that is no longer required may be deleted,
              anonymized, or securely archived according to TAKATAK
              retention procedures.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              11. Processing outside Québec
            </h2>

            <p className="mt-2">
              Some service providers may process or store information
              outside Québec or Canada. Information processed in
              another jurisdiction may be subject to the laws of that
              jurisdiction.
            </p>

            <p className="mt-2">
              TAKATAK evaluates service providers and applies
              reasonable contractual, technical, and organizational
              safeguards before transferring personal information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              12. Access and correction
            </h2>

            <p className="mt-2">
              Subject to applicable law, you may request access to
              personal information held about you and request the
              correction of inaccurate or incomplete information.
            </p>

            <p className="mt-2">
              TAKATAK may require identity verification before
              processing a privacy request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              13. Account deletion
            </h2>

            <p className="mt-2">
              You may request account deletion through the official
              TAKATAK support channel associated with your account.
            </p>

            <p className="mt-2">
              Certain records may be retained when required for
              security, fraud prevention, legal compliance, billing,
              dispute resolution, or enforcement purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              14. Privacy incidents
            </h2>

            <p className="mt-2">
              TAKATAK investigates suspected confidentiality and
              security incidents and takes reasonable steps to
              contain, assess, document, and correct confirmed
              incidents.
            </p>

            <p className="mt-2">
              Notifications will be provided when required by
              applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              15. Privacy requests
            </h2>

            <p className="mt-2">
              Requests concerning access, correction, deletion,
              consent, or privacy concerns may be submitted through
              the official TAKATAK support channel associated with
              your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">
              16. Policy updates
            </h2>

            <p className="mt-2">
              This Policy may be updated when dashboard services,
              providers, security practices, or legal requirements
              change. The current effective date will be displayed
              at the top of this page.
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
            href="/terms"
            className="font-semibold text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Terms of Service
          </Link>
        </footer>
      </article>
    </main>
  );
}