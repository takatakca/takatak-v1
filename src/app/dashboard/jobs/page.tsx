import { redirect } from "next/navigation";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { getServerAccessContext } from "@/lib/security/access-context";

export const dynamic = "force-dynamic";

/**
 * Background jobs. Platform staff open the real job monitor (database rows,
 * attempts, logs); clients see the "done by the TAKATAK team" page. Nobody sees
 * sample records.
 */
export default async function JobsPage() {
  const { access } = await getServerAccessContext();
  if (access.mode === "platform_admin") redirect("/dashboard/admin/jobs");
  return (
    <ModulePlaceholder
      def={{
        title: "Tâches · Jobs",
        purpose: "Les tâches de fond que TAKATAK exécute pour votre compte · Background tasks TAKATAK runs for your account.",
        status: "foundation",
        functions: [],
      }}
    />
  );
}
