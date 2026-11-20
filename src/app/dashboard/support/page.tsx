import { redirect } from "next/navigation";
import { DashboardSupportView } from "@/components/dashboard/support/dashboard-support-view";
import { getServerAccessContext } from "@/lib/security/access-context";

export const metadata = { title: "Soutien · Support" };

export default async function SupportPage() {
  const { access, displayEmail } = await getServerAccessContext();
  if (access.mode === "denied" && access.reason === "not_authenticated") {
    redirect("/login?next=%2Fdashboard%2Fsupport");
  }
  return <DashboardSupportView email={displayEmail} />;
}
