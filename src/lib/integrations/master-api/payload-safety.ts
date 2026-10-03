import { MasterApiInputError } from "./errors";

const FORBIDDEN_KEYS = new Set([
  "password",
  "passwordhash",
  "otp",
  "otpcode",
  "session",
  "sessiontoken",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "setcookie",
  "servicerolekey",
  "supabaseservicerolekey",
  "stripesecretkey",
  "clientsecret",
  "cardnumber",
  "cardtoken",
  "cvc",
  "cvv",
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenField);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) =>
      FORBIDDEN_KEYS.has(normalizedKey(key)) ||
      containsForbiddenField(nested),
  );
}

export function assertMasterPayloadSafe(value: unknown): void {
  if (containsForbiddenField(value)) {
    throw new MasterApiInputError(
      "Payload contains a forbidden secret or credential field.",
    );
  }
}


const ONE_LV_FINANCIAL_KEY_PATTERNS = [
  /^amount(?:minor)?$/,
  /^total$/,
  /^subtotal$/,
  /^currency$/,
  /^payment/,
  /^refund/,
  /^payout/,
  /^commission/,
  /^fee(?:s)?$/,
  /^invoice/,
  /^ledger/,
  /^lifetimevalue$/,
  /^stripe/,
] as const;

function containsOneLvFinancialField(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsOneLvFinancialField);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => {
      const normalized = normalizedKey(key);
      return (
        ONE_LV_FINANCIAL_KEY_PATTERNS.some((pattern) =>
          pattern.test(normalized),
        ) || containsOneLvFinancialField(nested)
      );
    },
  );
}

/**
 * 1LV remains the transaction/financial authority. The TAKATAK master API may
 * receive identity, merchant and customer-relationship context only.
 */
export function assertOneLvCustomerProjectionSafe(value: unknown): void {
  assertMasterPayloadSafe(value);

  if (containsOneLvFinancialField(value)) {
    throw new MasterApiInputError(
      "1LV financial data is not accepted by the TAKATAK master control plane.",
    );
  }
}
