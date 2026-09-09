import { DashboardHomeView } from "@/components/dashboard/home/dashboard-home-view";
import { getDashboardHomeData } from "@/lib/dashboard/home-data";
import { getServerAccessContext } from "@/lib/security/access-context";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const [{ access }, data] = await Promise.all([
    getServerAccessContext(),
    getDashboardHomeData({ from: params.from, to: params.to }),
  ]);

  return (
    <DashboardHomeView
      data={data}
      isPlatformAdmin={access.mode === "platform_admin"}
    />
  );
}
