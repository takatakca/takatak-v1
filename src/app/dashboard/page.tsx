import { DashboardHomeView } from "@/components/dashboard/home/dashboard-home-view";
import { getDashboardHomeData } from "@/lib/dashboard/home-data";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { getServerAccessContext } from "@/lib/security/access-context";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const [{ access, profileDetails }, data] = await Promise.all([
    getServerAccessContext(),
    getDashboardHomeData({ from: params.from, to: params.to }),
  ]);
  const language = await getDashboardLanguage(profileDetails?.id);

  return (
    <DashboardHomeView
      data={data}
      isPlatformAdmin={access.mode === "platform_admin"}
      language={language}
    />
  );
}
