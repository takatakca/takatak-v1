// MIMT live number search, as on mimt.ca. Copied from takatakca/mimtcaapp
// (packages/shared/src/numberSearch.ts, apps/web/lib/place.ts,
// apps/web/components/NumberPicker.tsx) on 2026-11-01. The browser calls the
// MIMT public API directly: its CORS list includes https://takatak.ca. Keep in
// step with those files; never invent a number, a count or a timer here.

export const MIMT_API_URL = "https://api.mimt.ca";
export const MIMT_APP_URL = "https://app.mimt.ca";

/** How long a picked number is held for the visitor (MIMT NUMBER_HOLD_MINUTES). */
export const NUMBER_HOLD_MINUTES = 10;

export interface PublicNumber {
  e164: string;
  locality: string | null;
  region: string | null;
}

export interface PublicNumberSearchResponse {
  label: { fr: string; en: string };
  areaCodes: string[];
  /** Real numbers the carrier offers right now, minus those MIMT holds or assigns. */
  numbers: PublicNumber[];
  /** Set when the asked area code was sold out and neighbours were offered instead. */
  fallback?: { from: string; to: string; message: { fr: string; en: string } };
}

export interface NumberHoldResponse {
  id: string;
  e164: string;
  status: "held" | "checkout" | "converted" | "expired" | "released" | "failed";
  expiresAt: string;
  /** Only on creation: proves the visitor owns the hold (kept in the page, sent in a URL fragment only). */
  token?: string;
}

export type HoldPlan = "lock" | "premium" | "business";

/** "+15145550199" → "514 555-0199" (fr) or "(514) 555-0199" (en). */
export function formatNanp(e164: string, lang: "fr" | "en" = "fr"): string {
  const d = e164.replace(/^\+1/, "");
  if (!/^\d{10}$/.test(d)) return e164;
  return lang === "fr" ? `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}` : `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const RATE_CENTRES: Record<string, string> = {
  pointeclaire: "Pointe-Claire",
  stjerome: "Saint-Jérôme",
  sthyacinthe: "Saint-Hyacinthe",
  stjeansurrichelieu: "Saint-Jean-sur-Richelieu",
  troisrivieres: "Trois-Rivières",
  ilebizard: "Île-Bizard",
};

const AREA_REGIONS: Record<string, { fr: string; en: string }> = {
  "514": { fr: "Montréal", en: "Montréal" },
  "438": { fr: "Montréal", en: "Montréal" },
  "263": { fr: "Montréal", en: "Montréal" },
  "450": { fr: "Couronne de Montréal", en: "Greater Montréal" },
  "579": { fr: "Couronne de Montréal", en: "Greater Montréal" },
  "354": { fr: "Couronne de Montréal", en: "Greater Montréal" },
  "418": { fr: "Québec et l'Est", en: "Québec City and East" },
  "581": { fr: "Québec et l'Est", en: "Québec City and East" },
  "367": { fr: "Québec et l'Est", en: "Québec City and East" },
  "819": { fr: "Ouest et Nord du Québec", en: "Western and Northern Québec" },
  "873": { fr: "Ouest et Nord du Québec", en: "Western and Northern Québec" },
  "416": { fr: "Toronto", en: "Toronto" },
  "647": { fr: "Toronto", en: "Toronto" },
  "437": { fr: "Toronto", en: "Toronto" },
};

export function placeName(e164: string, locality: string | null | undefined, region: string | null | undefined, fr: boolean): string {
  if (locality) {
    const key = locality.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    return RATE_CENTRES[key] ?? locality;
  }
  const area = e164.replace(/^\+1/, "").slice(0, 3);
  const known = AREA_REGIONS[area];
  if (known) return fr ? known.fr : known.en;
  return region ?? "";
}

/** A short reason a number is easy to remember (last 4 digits), or null. */
export function memorable(e164: string, fr: boolean): string | null {
  const last4 = e164.replace(/\D/g, "").slice(-4);
  if (last4.length < 4) return null;
  const d = last4.split("").map(Number);
  if (/^(\d)\1{3}$/.test(last4)) return fr ? "Quatre chiffres pareils" : "Four of a kind";
  if (last4.endsWith("000")) return fr ? "Finit par 000" : "Ends in 000";
  if (d.every((x, i) => i === 0 || x === d[i - 1] + 1) || d.every((x, i) => i === 0 || x === d[i - 1] - 1)) return fr ? "Suite de chiffres" : "Digit run";
  if (last4.endsWith("00")) return fr ? "Finit par 00" : "Ends in 00";
  if (last4[0] === last4[2] && last4[1] === last4[3]) return fr ? "Motif qui se répète" : "Repeating pattern";
  if (/(\d)\1\1/.test(last4)) return fr ? "Trois chiffres pareils" : "Triple digits";
  if (last4[0] === last4[1] && last4[2] === last4[3]) return fr ? "Chiffres doublés" : "Double digits";
  if (last4 === last4.split("").reverse().join("")) return fr ? "Se lit dans les deux sens" : "Reads both ways";
  return null;
}

/** Where the MIMT app picks the hold up (/numero). The token travels in the fragment, never in server logs. */
export function appHandoffUrl(hold: Pick<NumberHoldResponse, "id" | "token">, plan: HoldPlan, business?: { name: string; type: string }): string {
  const base = `${MIMT_APP_URL}/numero#hold=${encodeURIComponent(hold.id)}&t=${encodeURIComponent(hold.token ?? "")}&plan=${plan}`;
  const name = business?.name.trim().slice(0, 120);
  return plan === "business" && name && business ? `${base}&biz=${encodeURIComponent(name)}&type=${business.type}` : base;
}

export function numberErrorText(code: string | undefined, fr: boolean): string {
  switch (code) {
    case "unknown_place":
      return fr ? "Entrez un indicatif canadien (ex. 514) ou une ville." : "Enter a Canadian area code (e.g. 514) or a city.";
    case "rate_limited":
      return fr ? "Trop de recherches d'un coup. Réessayez dans une minute." : "Too many searches at once. Try again in a minute.";
    case "not_configured":
      return fr ? "La recherche de numéros n'est pas encore ouverte. Revenez bientôt." : "Number search is not open yet. Check back soon.";
    case "number_held":
    case "number_unavailable":
      return fr ? "Ce numéro vient d'être pris. Choisissez-en un autre." : "That number was just taken. Pick another one.";
    default:
      return fr ? "Le service ne répond pas. Réessayez dans un instant." : "The service is not answering. Try again in a moment.";
  }
}
