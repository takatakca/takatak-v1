"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  presentCatalogPricing,
  type CatalogPriceRow,
  type PublicPricing,
} from "@/lib/website/catalog-prices";

const CatalogPricingContext = createContext<PublicPricing>(presentCatalogPricing([]));

export function CatalogPricingProvider({
  rows,
  children,
}: {
  rows: readonly CatalogPriceRow[];
  children: ReactNode;
}) {
  const value = useMemo(() => presentCatalogPricing(rows), [rows]);
  return <CatalogPricingContext.Provider value={value}>{children}</CatalogPricingContext.Provider>;
}

export function usePublicPricing(): PublicPricing {
  return useContext(CatalogPricingContext);
}
