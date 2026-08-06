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