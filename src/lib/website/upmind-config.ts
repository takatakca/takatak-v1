export const UPMIND_ORDER_CONFIG_URL =
  process.env
    .NEXT_PUBLIC_UPMIND_ORDER_CONFIG_URL ??
  "https://fimjpyw0mnzy.upmind.app/order/product";

export const UPMIND_WIDGET_SCRIPT_URL =
  process.env
    .NEXT_PUBLIC_UPMIND_WIDGET_SCRIPT_URL ??
  "https://embed.upmind.app/upm-widget.js";

export const UPMIND_DAC_SCRIPT_URL =
  process.env
    .NEXT_PUBLIC_UPMIND_DAC_SCRIPT_URL ??
  "https://widgets.upmind.app/dac/upm-dac.min.js";

export const UPMIND_BRAND_ID =
  process.env
    .NEXT_PUBLIC_UPMIND_BRAND_ID ?? "";

export const UPMIND_ACCOUNT_ID =
  process.env
    .NEXT_PUBLIC_UPMIND_ACCOUNT_ID ?? "";

export const UPMIND_CURRENCY =
  process.env
    .NEXT_PUBLIC_UPMIND_CURRENCY ??
  "CAD";

export const UPMIND_HOSTING_PLANS = [
  {
    id: "61e50989-73d2-4752-053c-e45e610832d7",
    name: "Portfolio Hosting",
  },
  {
    id: "1e96d298-537d-4e75-383b-14e120637085",
    name: "Bronze Hosting",
  },
  {
    id: "80d1639e-237d-4395-3e2a-54610589e572",
    name: "Silver Hosting",
  },
  {
    id: "0381d780-e72d-4dd6-701c-8413569926e5",
    name: "Gold Hosting",
  },
] as const;

export const UPMIND_DOMAIN_SEARCH_MODE =
  process.env
    .NEXT_PUBLIC_UPMIND_DOMAIN_SEARCH_MODE ??
  "register";

export const SUPPORTED_DOMAIN_TLDS = [
  "ca",
  "com",
  "net",
  "org",
] as const;

export type SupportedDomainTld =
  (typeof SUPPORTED_DOMAIN_TLDS)[number];