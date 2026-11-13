import { ServiceError } from "./service-error";
export const MAX_QUANTITY = 1_000_000_000;
export function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ServiceError("invalid_input", "A valid record ID is required.");
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ServiceError("invalid_input", "A JSON object is required.");
  return value as Record<string, unknown>;
}
function text(v: unknown, name: string, max: number, optional = false): string {
  if (optional && (v === undefined || v === null || v === "")) return "";
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw new ServiceError(
      "invalid_input",
      `${name} is required (maximum ${max} characters).`,
    );
  return v.trim();
}
function integer(
  v: unknown,
  name: string,
  min = 0,
  max = MAX_QUANTITY,
): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max)
    throw new ServiceError(
      "invalid_input",
      `${name} must be a whole number between ${min} and ${max}.`,
    );
  return v;
}
export function normalizeGtin(v: unknown): string | null {
  const s = text(v, "UPC / EAN", 13, true);
  if (!s) return null;
  if (!/^\d{12,13}$/.test(s))
    throw new ServiceError(
      "invalid_input",
      "Use a 12-digit UPC-A or 13-digit EAN-13.",
    );
  const sum = [...s.slice(0, -1)]
    .reverse()
    .reduce((n, c, i) => n + Number(c) * (i % 2 ? 1 : 3), 0);
  if ((10 - (sum % 10)) % 10 !== Number(s.at(-1)))
    throw new ServiceError(
      "invalid_input",
      "The UPC / EAN check digit is invalid.",
    );
  return s.padStart(13, "0");
}
export function productInput(body: unknown) {
  const b = object(body);
  const sku = text(b.sku, "SKU", 40).toUpperCase();
  if (!/^[A-Z0-9 -]+$/.test(sku))
    throw new ServiceError(
      "invalid_input",
      "SKU supports letters, numbers, spaces and hyphens.",
    );
  return {
    businessBrandId: uuid(b.businessBrandId),
    name: text(b.name, "Product name", 160),
    sku,
    category: text(b.category, "Type / category", 120),
    size: text(b.size, "Package size", 80),
    ingredients: text(b.ingredients, "Ingredients", 2000),
    gtin: normalizeGtin(b.gtin),
    priceCents: integer(b.priceCents, "Price in cents"),
    threshold: integer(b.threshold, "Low stock threshold"),
  };
}
export function movementInput(body: unknown) {
  const b = object(body);
  const delta = integer(b.delta, "Quantity change", -MAX_QUANTITY);
  if (delta === 0)
    throw new ServiceError("invalid_input", "Quantity change must be nonzero.");
  return {
    productId: uuid(b.productId),
    requestId: uuid(b.requestId),
    delta,
    reason: text(b.reason, "Reason", 500),
    lot: text(b.lot, "Lot reference", 100, true) || null,
  };
}
export type ProductInput = ReturnType<typeof productInput>;
export type MovementInput = ReturnType<typeof movementInput>;
