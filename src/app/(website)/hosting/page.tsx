import type { Metadata } from "next";

import { HostingPageContent } from "@/components/website/pages/hosting-page-content";
import { getWebsiteSession } from "@/lib/website/website-session";

export const metadata: Metadata = {
  title: "Web Hosting",
};

export const dynamic = "force-dynamic";

export default async function HostingPage() {
  const session = await getWebsiteSession();

  return (
    <HostingPageContent isAuthenticated={session.isAuthenticated} />
  );
}
