import type { ReactNode } from "react";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import type { ModulePlaceholderDef } from "@/lib/dashboard/types";
import { getServerAccessContext } from "@/lib/security/access-context";

/**
 * A screen that does not work end to end for clients yet (disabled controls,
 * planning records, no engine behind it). TAKATAK platform staff see the
 * screen; everyone else sees what the space is for and a direct way to have
 * the TAKATAK team do it now. Owner's order (Nov 2026): no prototype in front
 * of a client.
 */
export async function StaffOnly({
  title,
  purpose,
  children,
}: {
  title: string;
  purpose: string;
  children: ReactNode;
}) {
  const { access } = await getServerAccessContext();
  if (access.mode !== "platform_admin") {
    const def: ModulePlaceholderDef = { title, purpose, status: "foundation", functions: [] };
    return <ModulePlaceholder def={def} />;
  }
  return <>{children}</>;
}
