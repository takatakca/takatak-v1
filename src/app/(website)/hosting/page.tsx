import type { Metadata } from "next";

import { CategorySalesPage } from "@/components/website/premium/CategorySalesPage";

export const metadata: Metadata = {
  title: "Web Hosting",
  description: "Managed hosting with free SSL, daily backups, business email and cPanel, supported by people in Canada.",
  alternates: { canonical: "/hosting" },
};

// Core category 02 sales page (src/lib/website/core-categories.ts). "Choose my
// plan" goes to /checkout, which sends visitors to sign in first.
export default function HostingPage() {
  return <CategorySalesPage categoryKey="hosting" />;
}
