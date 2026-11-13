import type { Metadata } from "next";

import { MarketplaceLanding } from "@/components/website/marketplace/MarketplaceLanding";
import { loadMarketplaceCards } from "@/lib/website/load-marketplace-cards";

export const metadata: Metadata = {
  title: "Place de marché · Marketplace",
  description:
    "Logos, sites web, contenu, automatisation et plus, livrés par TAKATAK avec paiement protégé. Logos, websites, content, automation and more, delivered through TAKATAK.",
  alternates: { canonical: "/marketplace" },
};

export default async function MarketplacePage() {
  return <MarketplaceLanding cards={await loadMarketplaceCards()} />;
}
