import { redirect } from "next/navigation";
import { DashboardSupportView } from "@/components/dashboard/support/dashboard-support-view";
import { getServerAccessContext } from "@/lib/security/access-context";

export const metadata = { title: "Soutien · Support" };

/** Ready-made requests other screens can open (only these keys; free text is never taken from the URL). */
const PREFILLED_REQUESTS: Record<string, string> = {
  "tiktok-business": "Bonjour, je veux brancher mon compte TikTok Business à TAKATAK. · Hello, I want to connect my TikTok Business account to TAKATAK.",
  "tiktok-ads": "Bonjour, je veux brancher mon compte TikTok Ads à TAKATAK. · Hello, I want to connect my TikTok Ads account to TAKATAK.",
  "google-business": "Bonjour, je veux brancher ma fiche Google Business Profile à TAKATAK. · Hello, I want to connect my Google Business Profile to TAKATAK.",
  website: "Bonjour, je veux ajouter un nouveau site Web à mon compte TAKATAK. · Hello, I want to add a new website to my TAKATAK account.",
  hosting: "Bonjour, je veux ajouter un hébergement à mon compte TAKATAK. · Hello, I want to add hosting to my TAKATAK account.",
  "hosting-plan": "Bonjour, je veux changer le forfait d’hébergement de mon site. · Hello, I want to change my website's hosting plan.",
  "hosting-settings": "Bonjour, je veux modifier les réglages de mon hébergement. · Hello, I want to change my hosting settings.",
  "website-settings": "Bonjour, je veux modifier les réglages de mon site Web. · Hello, I want to change my website settings.",
  "domain-settings": "Bonjour, je veux modifier les réglages d’un de mes domaines. · Hello, I want to change one of my domains' settings.",
  "website-connect": "Bonjour, je veux brancher mon site Web existant à TAKATAK (domaine, DNS et SSL). · Hello, I want to connect my existing website to TAKATAK (domain, DNS and SSL).",
  deploy: "Bonjour, je veux déployer une nouvelle version de mon site. · Hello, I want to deploy a new version of my website.",
  "hosting-upgrade": "Bonjour, je veux passer à un forfait d’hébergement supérieur. · Hello, I want to upgrade my hosting plan.",
  "site-favicon": "Bonjour, je veux changer l’icône (favicon) de mon site. · Hello, I want to change my website's favicon.",
  diagnostics: "Bonjour, je veux un diagnostic complet de mon hébergement (journaux, sauvegardes, performance). · Hello, I want a full hosting diagnostic (logs, backups, performance).",
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
