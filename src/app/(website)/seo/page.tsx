import type { Metadata } from "next";

import { SeoProductPage } from "@/components/website/seo/SeoProductPage";
import { loadMarketplaceCards } from "@/lib/website/load-marketplace-cards";
import { pickCards } from "@/lib/website/marketplace-cards";

export const metadata: Metadata = {
  title: "SEO TAKATAK · Référencement Google, carte locale et IA",
  description:
    "Audit de site, Core Web Vitals, données Search Console et plan d’action SEO, en français et en anglais. Outils gratuits, aucun lien acheté, aucun chiffre inventé.",
  alternates: { canonical: "/seo" },
};

/**
 * Real packages (marketplace-catalog.ts ids) that help a business show up on Google. Kept here, on the
 * server: a constant exported from a "use client" file reaches server code as a client reference.
 */
const SEO_START_PACKAGES = ["local-seo", "content-writing", "website-redesign"];

export default async function SeoPage() {
  const packages = pickCards(await loadMarketplaceCards(), SEO_START_PACKAGES);
  return <SeoProductPage packages={packages} />;
}
