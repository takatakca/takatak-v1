import type { Metadata } from "next";
import { MonitoringLanding } from "@/components/monitoring/landing";
import { monitoringBillingEnabled } from "@/lib/monitoring/billing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Website Monitoring",
  description: "Website availability checks, confirmed outage alerts and monthly reports. A TAKATAK add-on with one account and centralized billing.",
  alternates: { canonical: "/monitoring" },
};
export default function MonitoringLandingPage() {
  return <MonitoringLanding enrollmentOpen={monitoringBillingEnabled()} />;
}
