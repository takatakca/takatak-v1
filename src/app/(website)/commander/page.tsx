import type { Metadata } from "next";

import { OrderFunnel } from "@/components/website/funnel/OrderFunnel";
import { HomeThemeRoot } from "@/lib/website/home-theme";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: true },
};

// The order funnel (owner's brief, 2026-10-31): business type, then one service
// per step with real catalog tiers and a running total, then the review.
export default function OrderPage() {
  return (
    <div className="tk-page">
      <HomeThemeRoot>
        <OrderFunnel />
      </HomeThemeRoot>
    </div>
  );
}
