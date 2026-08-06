export interface QuotePrefill {
    packageId: string;
    title: string;
    category: string;
    tierName: string;
    tierPriceCents: number;
    addons: Array<{
      label: string;
      priceCents: number;
    }>;
    totalCents: number;
  }
  
  export interface CheckoutSelection
    extends QuotePrefill {
    deliveryDays: number;
    promoCode: string | null;
    discountCents: number;
    finalTotalCents: number;
  }
  
  const quoteKey =
    "takatak.marketplace.quote.v1";
  
  const checkoutKey =
    "takatak.marketplace.checkout.v1";
  
  function canUseStorage(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !==
        "undefined"
    );
  }
  
  export function saveQuotePrefill(
    value: QuotePrefill,
  ): void {
    if (!canUseStorage()) {
      return;
    }
  
    window.localStorage.setItem(
      quoteKey,
      JSON.stringify(value),
    );
  }
  
  export function readQuotePrefill(): QuotePrefill | null {
    if (!canUseStorage()) {
      return null;
    }
  
    try {
      const raw =
        window.localStorage.getItem(
          quoteKey,
        );
  
      return raw
        ? (JSON.parse(
            raw,
          ) as QuotePrefill)
        : null;
    } catch {
      return null;
    }
  }
  
  export function clearQuotePrefill(): void {
    if (!canUseStorage()) {
      return;
    }
  
    window.localStorage.removeItem(
      quoteKey,
    );
  }
  
  export function saveCheckoutSelection(
    value: CheckoutSelection,
  ): void {
    if (!canUseStorage()) {
      return;
    }
  
    window.localStorage.setItem(
      checkoutKey,
      JSON.stringify(value),
    );
  }
  
  export function readCheckoutSelection(): CheckoutSelection | null {
    if (!canUseStorage()) {
      return null;
    }
  
    try {
      const raw =
        window.localStorage.getItem(
          checkoutKey,
        );
  
      return raw
        ? (JSON.parse(
            raw,
          ) as CheckoutSelection)
        : null;
    } catch {
      return null;
    }
  }
  
  export function clearCheckoutSelection(): void {
    if (!canUseStorage()) {
      return;
    }
  
    window.localStorage.removeItem(
      checkoutKey,
    );
  }