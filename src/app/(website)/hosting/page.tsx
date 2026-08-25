import type { Metadata } from "next";

import { HostingPageContent } from "@/components/website/pages/hosting-page-content";

export const metadata: Metadata = {
  title: "Web Hosting",
};

export default function HostingPage() {
  return <HostingPageContent />;
}
