import { redirect } from "next/navigation";
import { DashboardSupportView } from "@/components/dashboard/support/dashboard-support-view";
import { getServerAccessContext } from "@/lib/security/access-context";

export const metadata = { title: "Soutien · Support" };

/** Ready-made requests other screens can open (only these keys; free text is never taken from the URL). */
const PREFILLED_REQUESTS: Record<string, string> = {
  "tiktok-business": "Bonjour, je veux brancher mon compte TikTok Business à TAKATAK. · Hello, I want to connect my TikTok Business account to TAKATAK.",
  "tiktok-ads": "Bonjour, je veux brancher mon compte TikTok Ads à TAKATAK. · Hello, I want to connect my TikTok Ads account to TAKATAK.",
  "google-business": "Bonjour, je veux brancher ma fiche Google Business Profile à TAKATAK. · Hello, I want to connect my Google Business Profile to TAKATAK.",
};

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ demande?: string }> }) {
  const { access, displayEmail } = await getServerAccessContext();
  if (access.mode === "denied" && access.reason === "not_authenticated") {
    redirect("/login?next=%2Fdashboard%2Fsupport");
  }
  const requested = (await searchParams).demande ?? "";
  const defaultMessage = Object.prototype.hasOwnProperty.call(PREFILLED_REQUESTS, requested) ? PREFILLED_REQUESTS[requested] : undefined;
  return <DashboardSupportView email={displayEmail} defaultMessage={defaultMessage} />;
}
