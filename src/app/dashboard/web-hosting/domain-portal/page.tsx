import Link from "next/link";
import { ExternalLink, FileUp, Globe2, LockKeyhole, ShieldCheck, Workflow } from "lucide-react";
import { getDnsRecordsData, getDomainAssetsData } from "@/lib/web-hosting/web-hosting-data";
import { domainProviderHandoff, MOCHAHOST_CLIENT_AREA_URL } from "@/lib/web-hosting/domain-provider-handoff";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Domain Provider Portal | TAKATAK", robots: { index: false, follow: false } };

/**
 * Handoff to the existing provider while TAKATAK and the customer coordinate
 * website migration. No provider credentials are captured, no fake SSO.
 * Domain/DNS list is scoped through existing shared data-scope layer.
 */
export default async function DomainProviderPortalPage() {
  const [domainData, dnsData] = await Promise.all([
    getDomainAssetsData(),
    getDnsRecordsData(),
  ]);
  const domains = domainData.domains.filter((d) => d.registrar !== "internal_demo");
  const records = dnsData.records.filter((record) => record.source !== "internal_demo");
  const mochaDomains = domains.filter((domain) => domainProviderHandoff(domain.registrar) !== null);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1565D8]">TAKATAK / Existing domain provider</p>
        <h1 className="text-2xl font-bold text-slate-900">Domain & Provider Portal</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Manage your website through TAKATAK and keep access to your current domain provider during transfer.
          Your MochaHost login remains with MochaHost. TAKATAK does not ask for or store that password.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-800">
            <Globe2 className="h-5 w-5 text-[#1565D8]" aria-hidden="true" />
            <h2 className="font-semibold">Current domain provider</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            If your domain is still with MochaHost, open its official client area to manage the
            services available on your existing account. Sign in there using your own provider credentials.
          </p>
          <a
            href={MOCHAHOST_CLIENT_AREA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1565D8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#104fab]"
          >
            Open MochaHost Client Area <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <p className="mt-2 text-xs text-slate-500">
            Opens the real provider site in a new tab. This is not single sign-on or a TAKATAK-hosted MochaHost login.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-800">
            <LockKeyhole className="h-5 w-5 text-[#1565D8]" aria-hidden="true" />
            <h2 className="font-semibold">DNS stays where it is managed</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            A website can move to TAKATAK without transferring its domain registration. DNS changes must be
            made at the authoritative DNS provider, which can differ from the registrar or cPanel.
            We will not change your nameservers, MX, email or other DNS records automatically.
          </p>
          <Link
            href="/dashboard/web-hosting/domains"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#1565D8] hover:bg-slate-50"
          >
            <Workflow className="h-4 w-4" aria-hidden="true" /> View TAKATAK domain records
          </Link>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#1565D8]" aria-hidden="true" />
          <h2 className="font-semibold text-slate-900">Domains linked to this TAKATAK workspace</h2>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {domainData.sourceLabel} Legacy MochaHost domains only appear once correctly linked to your account.
          A recorded domain is not proof that TAKATAK controls its external DNS.
        </p>
        <div className="mt-4 divide-y divide-slate-100">
          {domains.map((domain) => {
            const provider = domainProviderHandoff(domain.registrar);
            const recordCount = records.filter((record) => record.domainName === domain.domainName).length;
            return (
              <div key={domain.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-900">{domain.domainName}</p>
                  <p className="text-xs text-slate-500">
                    Registrar recorded: {domain.registrar || "Not confirmed"} · {recordCount} tracked DNS records
                  </p>
                </div>
                {provider ? (
                  <a
                    href={provider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-[#1565D8] hover:bg-blue-50"
                  >
                    Provider login <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">No verified provider login link</span>
                )}
              </div>
            );
          })}
          {domains.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              No verified or linked domains are available in this workspace yet. You can still sign in at your
              existing MochaHost account above; your TAKATAK team can link the legacy record after verification.
            </p>
          ) : null}
        </div>
        {mochaDomains.length ? (
          <p className="mt-2 text-xs text-slate-500">{mochaDomains.length} domain(s) have MochaHost recorded as registrar; DNS authority still needs verification.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <FileUp className="mt-1 h-5 w-5 shrink-0 text-[#1565D8]" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-slate-900">Website files and editing</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              While your website is still on MochaHost, use its existing authenticated cPanel File Manager
              where your hosting account provides that access. Once your website is hosted on TAKATAK,
              file editing and uploading must use an explicitly authorized site-scoped adapter.
              TAKATAK does not currently offer a connected server file editor on this page.
            </p>
            <Link href="/dashboard/web-hosting/websites" className="mt-3 inline-flex text-sm font-semibold text-[#1565D8] hover:underline">
              View my websites
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
