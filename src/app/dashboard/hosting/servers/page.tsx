import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { MODULE_PLACEHOLDERS } from "@/lib/dashboard/dashboard-config";

export default function HostingServersPage() {
  return <ModulePlaceholder def={MODULE_PLACEHOLDERS["hosting-servers"]} />;
}
