// GROUPE TAKATAK Billing — ecosystem apps allowed to feed invoice requests.
// Pure module. Adding an app here is the only change needed for a new
// vertical to feed the central billing queue (the DB enforces the format).

export const BILLING_SOURCE_APPS = [
  "manual",
  "takatak_core",
  "social",
  "ads",
  "web_hosting",
  "ahmv",
  "rentauto",
  "one_lv",
  "foodhub",
  "festi_ice",
  "alkao",
  "mimt",
  "qmaps",
  "on2go",
  "r2nette",
  "ocarina_spa",
  "emploi_direct",
] as const;

export type BillingSourceApp = (typeof BILLING_SOURCE_APPS)[number];

export const BILLING_SOURCE_APP_LABELS: Record<BillingSourceApp, string> = {
  manual: "Manual (TAKATAK admin)",
  takatak_core: "TAKATAK Core",
  social: "TAKATAK Social",
  ads: "TAKATAK Ads",
  web_hosting: "Web Hosting",
  ahmv: "AHMV",
  rentauto: "Rentauto",
  one_lv: "1LV",
  foodhub: "FoodHub",
  festi_ice: "FESTI-ICE",
  alkao: "ALKAO",
  mimt: "MIMT",
  qmaps: "QMAPS",
  on2go: "ON2GO",
  r2nette: "R2NETTE",
  ocarina_spa: "Ocarina Spa",
  emploi_direct: "EMPLOI DIRECT",
};

export function isBillingSourceApp(value: unknown): value is BillingSourceApp {
  return (
    typeof value === "string" &&
    (BILLING_SOURCE_APPS as readonly string[]).includes(value)
  );
}

/** Stable reference inside the source app, e.g. "booking:1f2c…" or "order/123". */
export const SOURCE_REFERENCE_PATTERN = /^[A-Za-z0-9._:/-]{1,200}$/;

export function isSourceReference(value: unknown): value is string {
  return typeof value === "string" && SOURCE_REFERENCE_PATTERN.test(value);
}
