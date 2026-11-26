import { redirect } from "next/navigation";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { getServerAccessContext } from "@/lib/security/access-context";

export const dynamic = "force-dynamic";

/**
 * Integrations. Platform staff open the real integrations screen; a client
 * workspace goes to its live connectors list (Growth › Connectors). Nobody
 * sees sample records.
 */
export default async function IntegrationsPage() {
  const { access } = await getServerAccessContext();
  if (access.mode === "platform_admin") redirect("/dashboard/admin/integrations");
  if (access.mode === "client_scoped") redirect("/dashboard/growth/connectors");
  return (
    <ModulePlaceholder
      def={{
        title: "Intégrations · Integrations",
        purpose: "Les connexions entre votre compte et vos outils · Connections between your account and outside tools.",
        status: "foundation",
        functions: [],
      }}
    />
  );
}
