import type { Metadata } from "next";

import { PrivacyManagerView } from "@/components/website/privacy/PrivacyManagerView";

export const metadata: Metadata = {
  title: "Confidentialité · Privacy manager",
  description:
    "Review the data TAKATAK collects across domains, hosting, marketplace, QMAPS, FLEXS, AI tools and notifications, and exercise your privacy rights.",
  alternates: { canonical: "/privacy-manager" },
};

export default function PrivacyManagerPage() {
  return <PrivacyManagerView />;
}
