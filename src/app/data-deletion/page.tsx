import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Data Deletion | TAKATAK",
  description:
    "Instructions for requesting deletion of personal and social account data stored by TAKATAK.",
};

export default function DataDeletionPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        User Data Deletion
      </h1>

      <p className="mt-6 text-lg text-muted-foreground">
        You may request deletion of personal information and connected social
        account data stored by TAKATAK.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">How to request deletion</h2>

        <ol className="list-decimal space-y-3 pl-6">
          <li>Sign in to your TAKATAK account.</li>
          <li>Open the Social dashboard.</li>
          <li>Disconnect Facebook, Instagram, or Threads.</li>
          <li>
            Email{" "}
            <a
              className="underline"
              href="mailto:takatak.ca@gmail.com?subject=User%20Data%20Deletion%20Request"
            >
              takatak.ca@gmail.com
            </a>{" "}
            using the email address associated with your TAKATAK account.
          </li>
          <li>
            Include your name and the social platform whose data you want
            deleted.
          </li>
        </ol>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Data covered by the request</h2>

        <p>
          After verification, TAKATAK will delete stored social connection
          tokens, connected account identifiers, profile information and
          associated social integration data, except information that must be
          retained for legal, security or accounting purposes.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Processing time</h2>

        <p>
          We will acknowledge your request and process verified deletion
          requests within 30 days, subject to applicable legal requirements.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">Contact</h2>

        <p>
          Questions about data deletion can be sent to{" "}
          <a className="underline" href="mailto:support@takatak.ca">
            takatak.ca@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}