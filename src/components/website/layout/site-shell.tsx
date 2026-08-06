import type { ReactNode } from "react";

import { SiteFooter } from "@/components/website/layout/site-footer";
import { SiteHeader } from "@/components/website/layout/site-header";

export function SiteShell({
  children,
  isAuthenticated,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        isAuthenticated={
          isAuthenticated
        }
      />

      <main className="flex-1 pb-16 sm:pb-0">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}