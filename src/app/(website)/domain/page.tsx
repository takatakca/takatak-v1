import type { Metadata } from "next";

import { DomainPageContent } from "@/components/website/pages/domain-page-content";

export const metadata: Metadata = {
  title: "Domain Names",
};

export default function DomainPage() {
  return <DomainPageContent />;
}
