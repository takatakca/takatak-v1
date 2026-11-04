import type { Metadata } from "next";

import { MarketplaceLanding } from "@/components/website/marketplace/MarketplaceLanding";

export const metadata: Metadata = {
  title: "Place de marché · Marketplace",
  description:
    "Logos, sites web, contenu, automatisation et plus, livrés par TAKATAK avec paiement protégé. Logos, websites, content, automation and more, delivered through TAKATAK.",
  alternates: { canonical: "/marketplace" },
};

export default function MarketplacePage() {
  return <MarketplaceLanding />;
}
