import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CheckoutClient } from "@/components/website/checkout/checkout-client";
import { getWebsiteSession } from "@/lib/website/website-session";
import { getUpmindSessionCustomer } from "@/lib/web-hosting/upmind-session-customer";

export const metadata: Metadata = {
  title: "Checkout — TAKATAK",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await getWebsiteSession();

  if (!session.isAuthenticated) {
    redirect(
      `/login?next=${encodeURIComponent("/checkout")}`,
    );
  }

  const customer = await getUpmindSessionCustomer();

  return <CheckoutClient upmindClientId={customer.clientId} />;
}