import type { Metadata } from "next";

import { SeoProductPage } from "@/components/website/seo/SeoProductPage";

export const metadata: Metadata = {
  title: "SEO TAKATAK · Référencement Google, carte locale et IA",
  description:
    "Audit de site, Core Web Vitals, données Search Console et plan d’action SEO, en français et en anglais. Outils gratuits, aucun lien acheté, aucun chiffre inventé.",
  alternates: { canonical: "/seo" },
};

export default function SeoPage() {
  return <SeoProductPage />;
}
