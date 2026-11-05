import Link from "next/link";
import { isBillingExemptWorkspace } from "@/lib/billing/billing-exemption-policy";
import { Activity, ArrowRight, FileDown } from "lucide-react";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { getMonitoringDashboard } from "@/lib/monitoring/store";
import { monitoringBillingEnabled } from "@/lib/monitoring/billing";
import { MONITORING_PATH, monitoringWorkspaceEntitled, snapshotState } from "@/lib/monitoring/policy";
import { MonitoringBillingButton } from "@/components/monitoring/billing-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website monitoring — TAKATAK" };
const states = { up: "Online", down: "Outage confirmed", unknown: "Confirming status", stale: "Check overdue", awaiting_check: "Awaiting first check" };

export default async function MonitoringPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const access = await requireWorkspacePermission("view_dashboard", MONITORING_PATH);
  const { rows, now, unavailable } = await getMonitoringDashboard(access.activeClientId);
  const canManage = hasEffectivePermission(access, "manage_settings");
  const billingExempt = isBillingExemptWorkspace(access.activeClientId);
  const checkout = (await searchParams).checkout;
  const month = new Date(now).toISOString().slice(0, 7);
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-[#1565D8]">TAKATAK add-ons</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Website monitoring</h1><p className="mt-2 text-sm text-slate-600">Your websites, confirmed alerts and monthly check reports.</p></div>
      <Link href="/dashboard/billing" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold">Plans &amp; billing <ArrowRight className="ml-2 inline h-4 w-4" /></Link>
    </header>
    {checkout === "success" && <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">Payment confirmation is pending. Monitoring activates after Stripe confirms your subscription; returning here does not activate it.</p>}
    {checkout === "canceled" && <p role="status" className="rounded-xl bg-slate-100 p-4 text-sm">Checkout was canceled. No add-on was activated by this return.</p>}
    <section className="rounded-2xl bg-[#060D1F] p-6 text-[#F5F8FC]">
      <Activity className="h-7 w-7 text-[#29C3FF]" /><h2 className="mt-3 text-xl font-semibold">One TAKATAK account. Monitoring for each website.</h2>
      <p className="mt-2 max-w-3xl text-sm text-[#B8C4D3]">{billingExempt ? "Included for this TAKATAK internal workspace. Checks require an authorized monitoring worker and the first successful sync." : "$5 CAD per website / month, plus applicable taxes. Checks every five minutes, confirmed outage and recovery alerts, and monthly reports. Service starts after payment and the first successful worker sync."}</p>
      {!billingExempt && !monitoringBillingEnabled() && <p className="mt-3 text-sm text-amber-200">Enrollment opens after the monitoring service is activated. Your existing services continue as usual.</p>}
    </section>
    {unavailable ? <p role="alert" className="rounded-xl border border-amber-200 p-5">Monitoring data is temporarily unavailable. Please try again later.</p> : rows.length === 0 ? <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Add your website first</h2><p className="mt-2 text-sm text-slate-600">Monitoring uses websites assigned to your selected TAKATAK workspace.</p><Link className="mt-4 inline-block font-semibold text-[#1565D8]" href="/dashboard/web-hosting/domains">Manage your domains</Link></section> :
      <div className="grid gap-4 xl:grid-cols-2">{rows.map(row => {
        const active = monitoringWorkspaceEntitled(access.activeClientId, row.billing, now), state = snapshotState(row.snapshot, now);
        const stats = row.snapshot?.months.find(value => value.month === month);
        return <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">{row.hostname}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${!active || state === "stale" ? "bg-amber-50 text-amber-800" : state === "up" ? "bg-emerald-50 text-emerald-800" : state === "down" ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-700"}`}>{active ? states[state] : "Add-on inactive"}</span></div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500">Last observation (UTC)</dt><dd className="mt-1 font-medium">{row.snapshot ? new Date(row.snapshot.observedAt * 1000).toISOString().replace("T", " ").slice(0, 19) : "No observations yet"}</dd></div>
            <div><dt className="text-slate-500">Response time</dt><dd className="mt-1 font-medium">{row.snapshot?.ok ? `${row.snapshot.latencyMs} ms` : "—"}</dd></div>
            <div><dt className="text-slate-500">{month} successful checks</dt><dd className="mt-1 font-medium">{stats?.checks ? `${(stats.successes / stats.checks * 100).toFixed(2)}% (${stats.successes}/${stats.checks})` : "No observations yet"}</dd></div>
            <div><dt className="text-slate-500">Subscription</dt><dd className="mt-1 font-medium">{billingExempt ? "Included — billing exempt" : row.billing.cancelAtPeriodEnd && active ? "Cancels at period end" : row.billing.status.replaceAll("_", " ")}</dd></div>
          </dl>
          {canManage && !billingExempt && <div className="mt-5"><MonitoringBillingButton domainAssetId={row.id} subscribed={!["not_subscribed", "canceled", "incomplete_expired"].includes(row.billing.status)} enabled={monitoringBillingEnabled()} /></div>}
        </article>;
      })}</div>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      <p>Reports describe observed checks, not continuous uptime. Missing checks are unknown. Monitoring detects HTTP availability; it does not prove that checkout or every website feature works.</p>
      {hasEffectivePermission(access, "view_reports") && <div className="mt-4 flex flex-wrap gap-4">{[month, new Date(new Date(now).setUTCDate(0)).toISOString().slice(0, 7)].map(value => <a key={value} className="font-semibold text-[#1565D8]" href={`/api/web-hosting/monitoring/report?month=${value}`}><FileDown className="mr-1 inline h-4 w-4" />{value} CSV</a>)}</div>}
    </section>
  </div>;
}
