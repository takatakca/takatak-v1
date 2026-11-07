import type { Metadata } from "next";

import { CategorySalesPage } from "@/components/website/premium/CategorySalesPage";

export const metadata: Metadata = {
  title: "Noms de domaine · Domain names",
  description: "Register your .ca, .com, .net or .org with DNS, business email and renewals handled by the TAKATAK team.",
  alternates: { canonical: "/domain" },
};

// Core category 01 sales page (src/lib/website/core-categories.ts).
export default function DomainPage() {
  return <CategorySalesPage categoryKey="domains" />;
}
