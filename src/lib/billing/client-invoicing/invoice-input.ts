// Client invoicing — validation and estimate for an invoice a client sends to
// ITS OWN customer from its own Stripe account. Pure module.
// Money is integer cents, CAD only. Tax rates are explicit inputs chosen by
// the client (milli-percent: 5000 = 5.000 %); no jurisdiction is assumed.
// Stripe computes the authoritative total; the estimate is for display.

export const CLIENT_INVOICE_LIMITS = {
  maxLines: 25,
  maxTaxRates: 4,
  maxQuantity: 10_000,
  maxCents: 99_999_999,
  maxPercentMilli: 30_000,
  minDaysUntilDue: 1,
  maxDaysUntilDue: 90,
} as const;

export interface ClientInvoiceLine {
  description: string;
  quantity: number;
  unitAmountCents: number;
}

export interface ClientInvoiceTaxRate {
  displayName: string;
  percentMilli: number;
}

export interface ClientInvoiceInput {
  reference: string;
  customer: { name: string; email: string };
  lines: ClientInvoiceLine[];
  taxRates: ClientInvoiceTaxRate[];
  daysUntilDue: number;
  memo: string | null;
}

export type ClientInvoiceValidation =
  | { ok: true; value: ClientInvoiceInput }
  | { ok: false; errors: string[] };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/;
const TAX_NAME_PATTERN = /^[\p{L}\p{N} ._-]{1,40}$/u;
// Control characters are never accepted in text Stripe will print.
const CONTROL = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length >= 1 && trimmed.length <= max && !CONTROL.test(trimmed) ? trimmed : null;
}

function int(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

export function validateClientInvoiceInput(raw: unknown): ClientInvoiceValidation {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ["Facture invalide."] };
  }

  const reference = typeof raw.reference === "string" && UUID_PATTERN.test(raw.reference) ? raw.reference.toLowerCase() : null;
  if (!reference) errors.push("Référence de formulaire invalide. Rechargez la page.");

  const customer = isRecord(raw.customer) ? raw.customer : {};
  const name = text(customer.name, 120);
  if (!name) errors.push("Nom du client requis (120 caractères max).");
  const email = typeof customer.email === "string" ? customer.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.push("Courriel du client invalide.");

  const lines: ClientInvoiceLine[] = [];
  if (!Array.isArray(raw.lines) || raw.lines.length < 1 || raw.lines.length > CLIENT_INVOICE_LIMITS.maxLines) {
    errors.push(`Entre 1 et ${CLIENT_INVOICE_LIMITS.maxLines} lignes.`);
  } else {
    raw.lines.forEach((line, index) => {
      const row = isRecord(line) ? line : {};
      const description = text(row.description, 200);
      const quantity = int(row.quantity, 1, CLIENT_INVOICE_LIMITS.maxQuantity);
      const unitAmountCents = int(row.unitAmountCents, 1, CLIENT_INVOICE_LIMITS.maxCents);

      if (!description || quantity === null || unitAmountCents === null) {
        errors.push(`Ligne ${index + 1} : description, quantité et prix requis.`);
        return;
      }

      if (quantity * unitAmountCents > CLIENT_INVOICE_LIMITS.maxCents) {
        errors.push(`Ligne ${index + 1} : montant trop élevé.`);
        return;
      }

      lines.push({ description, quantity, unitAmountCents });
    });
  }

  const taxRates: ClientInvoiceTaxRate[] = [];
  if (!Array.isArray(raw.taxRates) || raw.taxRates.length > CLIENT_INVOICE_LIMITS.maxTaxRates) {
    errors.push(`Au plus ${CLIENT_INVOICE_LIMITS.maxTaxRates} taxes.`);
  } else {
    const seen = new Set<string>();
    raw.taxRates.forEach((tax, index) => {
      const row = isRecord(tax) ? tax : {};
      const displayName = typeof row.displayName === "string" ? row.displayName.trim() : "";
      const percentMilli = int(row.percentMilli, 1, CLIENT_INVOICE_LIMITS.maxPercentMilli);

      if (!TAX_NAME_PATTERN.test(displayName) || percentMilli === null) {
        errors.push(`Taxe ${index + 1} : nom et taux (0,001 % à 30 %) requis.`);
        return;
      }

      const key = displayName.toLowerCase();
      if (seen.has(key)) {
        errors.push(`Taxe ${index + 1} : « ${displayName} » est déjà appliquée.`);
        return;
      }

      seen.add(key);
      taxRates.push({ displayName, percentMilli });
    });
  }

  const daysUntilDue = int(raw.daysUntilDue, CLIENT_INVOICE_LIMITS.minDaysUntilDue, CLIENT_INVOICE_LIMITS.maxDaysUntilDue);
  if (daysUntilDue === null) errors.push("Échéance entre 1 et 90 jours.");

  let memo: string | null = null;
  if (raw.memo !== undefined && raw.memo !== null && raw.memo !== "") {
    memo = text(raw.memo, 500);
    if (!memo) errors.push("Note : 500 caractères max.");
  }

  if (errors.length === 0) {
    const estimate = estimateClientInvoice({ lines, taxRates });
    if (estimate.totalCents > CLIENT_INVOICE_LIMITS.maxCents) {
      errors.push("Total trop élevé pour une facture en ligne.");
    }
  }

  if (errors.length > 0 || !reference || !name || daysUntilDue === null) {
    return { ok: false, errors };
  }

  return { ok: true, value: { reference, customer: { name, email }, lines, taxRates, daysUntilDue, memo } };
}

export interface ClientInvoiceEstimate {
  subtotalCents: number;
  taxes: Array<{ displayName: string; percentMilli: number; amountCents: number }>;
  totalCents: number;
}

/** Each tax independently on the subtotal, rounded half-up. Display only. */
export function estimateClientInvoice(input: Pick<ClientInvoiceInput, "lines" | "taxRates">): ClientInvoiceEstimate {
  const subtotalCents = input.lines.reduce((sum, line) => sum + line.quantity * line.unitAmountCents, 0);
  const taxes = input.taxRates.map((tax) => ({
    displayName: tax.displayName,
    percentMilli: tax.percentMilli,
    amountCents: Math.floor((subtotalCents * tax.percentMilli + 50_000) / 100_000),
  }));

  return {
    subtotalCents,
    taxes,
    totalCents: subtotalCents + taxes.reduce((sum, tax) => sum + tax.amountCents, 0),
  };
}

/** Stripe percentage from milli-percent: 9975 → 9.975. */
export function stripePercentage(percentMilli: number): number {
  return percentMilli / 1000;
}
