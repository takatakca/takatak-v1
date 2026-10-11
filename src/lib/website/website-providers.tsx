"use client";

import type { ReactNode } from "react";

import { WebsiteAuthProvider } from "@/lib/website/auth-context";
import { CatalogPricingProvider } from "@/lib/website/catalog-pricing-context";
import type { CatalogPriceRow } from "@/lib/website/catalog-prices";
import { LanguageProvider } from "@/lib/website/use-language";

export function WebsiteProviders({
  isAuthenticated,
  email = null,
  catalogRows = [],
  children,
}: {
  isAuthenticated: boolean;
  email?: string | null;
  catalogRows?: readonly CatalogPriceRow[];
  children: ReactNode;
}) {
  return (
    <LanguageProvider>
      <CatalogPricingProvider rows={catalogRows}>
        <WebsiteAuthProvider isAuthenticated={isAuthenticated} email={email}>
          {children}
        </WebsiteAuthProvider>
      </CatalogPricingProvider>
    </LanguageProvider>
  );
}
