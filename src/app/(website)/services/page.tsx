import type { Metadata } from "next";

import { ServicesIndexContent } from "@/components/website/pages/services-index-content";

export const metadata: Metadata = {
  title: "All Services",
  description:
    "Every TAKATAK service: domains, hosting, websites, apps, marketing, social, local visibility, leads, VoIP, automation and marketplace talent.",
  alternates: { canonical: "/services" },
};

export default function ServicesIndexPage() {
  return <ServicesIndexContent />;
}
