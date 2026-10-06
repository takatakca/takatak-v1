// GROUPE TAKATAK Billing — invoice draft input shared by every ecosystem app.
// Pure module. Mirrors the Facturations DraftInput contract exactly
// (docs/takatak-integration-v1.openapi.json + src/draft-preview.js) so that a
// request accepted here is never rejected for shape by Facturations.
//
// Money is integer cents, CAD only. Tax rates are explicit milli-percent
// inputs (5000 = 5.000 %); no jurisdictional rate is ever assumed.

import type { FieldErrors, ValidationResult } from "@/lib/validation/common";

export const INVOICE_CURRENCY = "CAD" as const;
export const INVOICE_LIMITS = {
  customerName: 160,
  customerEmail: 254,
  customerAddress: 500,
  notes: 1000,
  lineDescription: 250,
  minLines: 1,
  maxLines: 50,
  maxTaxes: 3,
  maxQuantity: 1000,
  maxUnitPriceCents: 100_000_000,
  taxCode: 20,
  taxLabel: 80,
  maxRateMilliPercent: 100_000,
  /** Facturations refuses request bodies above 32 768 bytes; keep a margin. */
  maxSerializedBytes: 32_000,
} as const;

export interface InvoiceCustomerInput {
  name: string;
  email: string;
  address: string | null;
}

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  taxable: boolean;
}

export interface InvoiceTaxInput {
  code: string;
  label: string;
  rateMilliPercent: number;
}

export interface InvoiceDraftInput {
  currency: typeof INVOICE_CURRENCY;
  customer: InvoiceCustomerInput;
  invoiceDate: string;
  dueDate: string;
  notes: string | null;
  lines: InvoiceLineInput[];
  taxes: InvoiceTaxInput[];
}

const DRAFT_KEYS = ["currency", "customer", "invoiceDate", "dueDate", "notes", "lines", "taxes"];
const CUSTOMER_KEYS = ["name", "email", "address"];
const LINE_KEYS = ["description", "quantity", "unitPriceCents", "discountCents", "taxable"];
const TAX_KEYS = ["code", "label", "rateMilliPercent"];
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const TAX_CODE_PATTERN = /^[A-Z0-9_-]+$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);

      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }

      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }

  return false;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function readText(
  value: unknown,
  maximum: number,
  field: string,
  errors: FieldErrors,
  required: boolean,
): string | null {
  if (value === undefined || value === null) {
    if (required) {
      errors[field] = "This field is required.";
    }

    return null;
  }

  if (typeof value !== "string") {
    errors[field] = "This field must be text.";
    return null;
  }

  const result = value.trim();

  if (required && !result) {
    errors[field] = "This field is required.";
    return null;
  }

  if (
    result.length > maximum ||
    CONTROL_CHARACTERS.test(result) ||
    hasUnpairedSurrogate(result)
  ) {
    errors[field] = `Use at most ${maximum} printable characters.`;
    return null;
  }

  return result || null;
}

function readInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
  errors: FieldErrors,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    errors[field] = `Use a whole number between ${minimum} and ${maximum}.`;
    return 0;
  }

  return value as number;
}

export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateInvoiceDraftInput(
  payload: unknown,
): ValidationResult<InvoiceDraftInput> {
  const errors: FieldErrors = {};

  if (!isRecord(payload) || !hasOnlyKeys(payload, DRAFT_KEYS)) {
    return {
      success: false,
      message: "The invoice draft is invalid.",
      fieldErrors: { draft: "Unexpected or missing invoice fields." },
    };
  }

  if (payload.currency !== INVOICE_CURRENCY) {
    errors.currency = "Only CAD invoices are supported.";
  }

  let customer: InvoiceCustomerInput = { name: "", email: "", address: null };

  if (!isRecord(payload.customer) || !hasOnlyKeys(payload.customer, CUSTOMER_KEYS)) {
    errors.customer = "Customer must contain name, email and optional address.";
  } else {
    const name = readText(payload.customer.name, INVOICE_LIMITS.customerName, "customer.name", errors, true);
    const email = readText(payload.customer.email, INVOICE_LIMITS.customerEmail, "customer.email", errors, true);

    if (email && !EMAIL_PATTERN.test(email)) {
      errors["customer.email"] = "Enter a valid email address.";
    }

    customer = {
      name: name ?? "",
      email: email ?? "",
      address: readText(
        payload.customer.address,
        INVOICE_LIMITS.customerAddress,
        "customer.address",
        errors,
        false,
      ),
    };
  }

  const invoiceDate = isValidCalendarDate(payload.invoiceDate) ? payload.invoiceDate : "";
  const dueDate = isValidCalendarDate(payload.dueDate) ? payload.dueDate : "";

  if (!invoiceDate) {
    errors.invoiceDate = "Use a valid YYYY-MM-DD date.";
  }

  if (!dueDate) {
    errors.dueDate = "Use a valid YYYY-MM-DD date.";
  }

  if (invoiceDate && dueDate && dueDate < invoiceDate) {
    errors.dueDate = "The due date cannot be before the invoice date.";
  }

  const notes = readText(payload.notes, INVOICE_LIMITS.notes, "notes", errors, false);
  const lines: InvoiceLineInput[] = [];

  if (
    !Array.isArray(payload.lines) ||
    payload.lines.length < INVOICE_LIMITS.minLines ||
    payload.lines.length > INVOICE_LIMITS.maxLines
  ) {
    errors.lines = `Provide between ${INVOICE_LIMITS.minLines} and ${INVOICE_LIMITS.maxLines} lines.`;
  } else {
    payload.lines.forEach((raw, index) => {
      const prefix = `lines.${index}`;

      if (!isRecord(raw) || !hasOnlyKeys(raw, LINE_KEYS)) {
        errors[prefix] = "Unexpected or missing line fields.";
        return;
      }

      const description = readText(
        raw.description,
        INVOICE_LIMITS.lineDescription,
        `${prefix}.description`,
        errors,
        true,
      );
      const quantity = readInteger(raw.quantity, 1, INVOICE_LIMITS.maxQuantity, `${prefix}.quantity`, errors);
      const unitPriceCents = readInteger(
        raw.unitPriceCents,
        0,
        INVOICE_LIMITS.maxUnitPriceCents,
        `${prefix}.unitPriceCents`,
        errors,
      );
      const gross = quantity * unitPriceCents;
      const discountCents = readInteger(raw.discountCents ?? 0, 0, gross, `${prefix}.discountCents`, errors);

      if (typeof raw.taxable !== "boolean") {
        errors[`${prefix}.taxable`] = "Taxable must be true or false.";
      }

      lines.push({
        description: description ?? "",
        quantity,
        unitPriceCents,
        discountCents,
        taxable: raw.taxable === true,
      });
    });
  }

  const taxes: InvoiceTaxInput[] = [];

  if (!Array.isArray(payload.taxes) || payload.taxes.length > INVOICE_LIMITS.maxTaxes) {
    errors.taxes = `Provide at most ${INVOICE_LIMITS.maxTaxes} taxes.`;
  } else {
    const codes = new Set<string>();

    payload.taxes.forEach((raw, index) => {
      const prefix = `taxes.${index}`;

      if (!isRecord(raw) || !hasOnlyKeys(raw, TAX_KEYS)) {
        errors[prefix] = "Unexpected or missing tax fields.";
        return;
      }

      const code = readText(raw.code, INVOICE_LIMITS.taxCode, `${prefix}.code`, errors, true);

      if (code && (!TAX_CODE_PATTERN.test(code) || codes.has(code))) {
        errors[`${prefix}.code`] = "Tax codes are unique, uppercase letters, digits, _ or -.";
      }

      if (code) {
        codes.add(code);
      }

      taxes.push({
        code: code ?? "",
        label: readText(raw.label, INVOICE_LIMITS.taxLabel, `${prefix}.label`, errors, true) ?? "",
        rateMilliPercent: readInteger(
          raw.rateMilliPercent,
          0,
          INVOICE_LIMITS.maxRateMilliPercent,
          `${prefix}.rateMilliPercent`,
          errors,
        ),
      });
    });
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: "Correct the highlighted invoice fields.",
      fieldErrors: errors,
    };
  }

  const data: InvoiceDraftInput = {
    currency: INVOICE_CURRENCY,
    customer,
    invoiceDate,
    dueDate,
    notes,
    lines,
    taxes,
  };

  if (new TextEncoder().encode(JSON.stringify(data)).length > INVOICE_LIMITS.maxSerializedBytes) {
    return {
      success: false,
      message: "The invoice is too large for Facturations. Shorten descriptions or split it.",
      fieldErrors: { draft: `The serialized invoice must stay under ${INVOICE_LIMITS.maxSerializedBytes} bytes.` },
    };
  }

  return { success: true, data };
}
