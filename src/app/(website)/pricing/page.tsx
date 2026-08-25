import type { Metadata } from "next";

import { PricingPageContent } from "@/components/website/pages/pricing-page-content";

export const metadata: Metadata = {
  title: "Pricing (CAD)",
  description:
    "Transparent CAD pricing for domains, hosting, websites, apps, branding, marketing, VoIP, automation and design services.",
};

export default function PricingPage() {
  return <PricingPageContent />;
}
