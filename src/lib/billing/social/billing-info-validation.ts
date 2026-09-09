import {
  normalizeEmail,
  validateEmail,
} from "@/lib/auth/registration-validation";
import {
  invalidRequest,
  isRecord,
  type ValidationResult,
} from "@/lib/validation/common";

export interface BillingInfoInput {
  companyName: string;
  vatTaxId: string | null;
  billingAddress: string | null;
  billingCountry: string;
  invoiceEmails: string[];
}

const COMPANY_MAX = 120;
const VAT_MAX = 40;
const ADDRESS_MAX = 300;
const COUNTRY_MAX = 80;
const EMAILS_MAX = 10;

export function validateBillingInfoInput(
  value: unknown,
): ValidationResult<BillingInfoInput> {
  if (!isRecord(value)) {
    return invalidRequest({}, "The billing information request is invalid.");
  }

  const fieldErrors: Record<string, string> = {};

  const companyName =
    typeof value.companyName === "string" ? value.companyName.trim() : "";
  if (!companyName) {
    fieldErrors.companyName = "Company is required.";
  } else if (companyName.length > COMPANY_MAX) {
    fieldErrors.companyName = `Company must be ${COMPANY_MAX} characters or fewer.`;
  }

  let vatTaxId: string | null = null;
  if (
    value.vatTaxId !== undefined &&
    value.vatTaxId !== null &&
    value.vatTaxId !== ""
  ) {
    if (typeof value.vatTaxId !== "string") {
      fieldErrors.vatTaxId = "VAT / tax ID must be text.";
    } else {
      vatTaxId = value.vatTaxId.trim();
      if (vatTaxId.length > VAT_MAX) {
        fieldErrors.vatTaxId = `VAT / tax ID must be ${VAT_MAX} characters or fewer.`;
        vatTaxId = vatTaxId.slice(0, VAT_MAX);
      }
    }
  }

  let billingAddress: string | null = null;
  if (
    value.billingAddress !== undefined &&
    value.billingAddress !== null &&
    value.billingAddress !== ""
  ) {
    if (typeof value.billingAddress !== "string") {
      fieldErrors.billingAddress = "Address must be text.";
    } else {
      billingAddress = value.billingAddress.trim();
      if (billingAddress.length > ADDRESS_MAX) {
        fieldErrors.billingAddress = `Address must be ${ADDRESS_MAX} characters or fewer.`;
      }
    }
  }

  const billingCountry =
    typeof value.billingCountry === "string"
      ? value.billingCountry.trim()
      : "";
  if (!billingCountry) {
    fieldErrors.billingCountry = "Country is required.";
  } else if (billingCountry.length > COUNTRY_MAX) {
    fieldErrors.billingCountry = `Country must be ${COUNTRY_MAX} characters or fewer.`;
  }

  const invoiceEmails: string[] = [];
  if (value.invoiceEmails !== undefined && value.invoiceEmails !== null) {
    if (!Array.isArray(value.invoiceEmails)) {
      fieldErrors.invoiceEmails = "Invoice emails must be a list.";
    } else if (value.invoiceEmails.length > EMAILS_MAX) {
      fieldErrors.invoiceEmails = `You can save at most ${EMAILS_MAX} invoice emails.`;
    } else {
      for (const item of value.invoiceEmails) {
        if (typeof item !== "string") {
          fieldErrors.invoiceEmails = "Each invoice email must be text.";
          break;
        }
        const email = normalizeEmail(item);
        const error = validateEmail(email);
        if (error) {
          fieldErrors.invoiceEmails = error;
          break;
        }
        if (!invoiceEmails.includes(email)) {
          invoiceEmails.push(email);
        }
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return invalidRequest(fieldErrors, "Correct the highlighted billing fields.");
  }

  return {
    success: true,
    data: {
      companyName,
      vatTaxId,
      billingAddress,
      billingCountry,
      invoiceEmails,
    },
  };
}
