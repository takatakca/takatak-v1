export type UpmindWebhookEnvelope = {
  webhookEventId: string | null;
  hookCategory: string;
  hookCode: string;
  objectType: string;
  objectId: string | null;
  object: Record<string, unknown>;
};

const DOMAIN_KEY_HINTS = [
  "domain",
  "domain_name",
  "domainname",
  "fqdn",
  "hostname",
  "sld",
];

const APPLY_HOOK_FRAGMENTS = [
  "contract_product_created",
  "contract_product_awaiting_activation",
  "contract_product_activated",
  "contract_product_setup_failed",
  "contract_product_renewed",
  "contract_product_cancelled",
  "invoice_paid",
  "invoice_created",
  "invoice_cancelled",
  "invoice_refunded",
  "invoice_payment_received",
  "invoice_payment_refunded",
  "invoice_payment_failed",
  "provision_result_success",
  "provision_result_error",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isLikelyDomainName(value: string): boolean {
  const candidate = value.trim().toLowerCase();
  if (!candidate || candidate.includes("@") || candidate.includes(" ")) {
    return false;
  }
  if (candidate.length < 4 || candidate.length > 253) {
    return false;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(candidate)) {
    return false;
  }
  if (candidate.endsWith(".local") || candidate.endsWith(".test")) {
    return false;
  }
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(candidate);
}

function domainFromText(value: string): string | null {
  if (isLikelyDomainName(value)) {
    return value.trim().toLowerCase();
  }
  const match = value.match(
    /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/i,
  );
  if (!match || match[0].includes("@")) {
    return null;
  }
  return isLikelyDomainName(match[0]) ? match[0].toLowerCase() : null;
}

function collectDomains(
  value: unknown,
  depth: number,
  found: Set<string>,
): void {
  if (depth > 6 || value == null) {
    return;
  }
  if (typeof value === "string") {
    const domain = domainFromText(value);
    if (domain) {
      found.add(domain);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectDomains(item, depth + 1, found);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  const skipKey =
    /email|portal|url|phone|ip_address|picture|language|currency|password|hash/i;

  for (const [key, nested] of Object.entries(value)) {
    if (DOMAIN_KEY_HINTS.includes(key.toLowerCase())) {
      collectDomains(nested, depth + 1, found);
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    if (skipKey.test(key) || DOMAIN_KEY_HINTS.includes(key.toLowerCase())) {
      continue;
    }
    collectDomains(nested, depth + 1, found);
  }
}

export function collectDomainNames(value: unknown): string[] {
  const found = new Set<string>();
  collectDomains(value, 0, found);
  return [...found];
}

export function parseUpmindWebhookPayload(
  rawBody: string,
): UpmindWebhookEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }

  const object = isRecord(parsed.object) ? parsed.object : {};

  return {
    webhookEventId: asString(parsed.webhook_event_id),
    hookCategory: (asString(parsed.hook_category) ?? "").toLowerCase(),
    hookCode: (asString(parsed.hook_code) ?? "").toLowerCase(),
    objectType: (asString(parsed.object_type) ?? "").toLowerCase(),
    objectId: asString(parsed.object_id) ?? asString(object.id),
    object,
  };
}

export function extractUpmindClientId(
  envelope: UpmindWebhookEnvelope,
): string | null {
  const object = envelope.object;
  const nestedClient = isRecord(object.client) ? object.client : null;
  return (
    asString(object.client_id) ??
    asString(nestedClient?.id) ??
    (envelope.hookCategory === "client" || envelope.objectType === "client"
      ? asString(object.id)
      : null)
  );
}

export function extractDomainName(
  envelope: UpmindWebhookEnvelope,
): string | null {
  return collectDomainNames(envelope.object)[0] ?? null;
}

export function webhookAppliesToDomain(
  envelope: UpmindWebhookEnvelope,
): boolean {
  const code = envelope.hookCode.replace(/_hook$/, "");
  return APPLY_HOOK_FRAGMENTS.some(
    (fragment) => code === fragment || code.includes(fragment),
  );
}

export function domainStatusForHook(
  hookCode: string,
): "pending_connection" | "tracked" | "cancelled" {
  const code = hookCode.replace(/_hook$/, "");
  if (
    code.includes("cancelled") ||
    code.includes("refunded")
  ) {
    return "cancelled";
  }
  if (
    code.includes("activated") ||
    code.includes("renewed") ||
    code.includes("provision_result_success")
  ) {
    return "tracked";
  }
  if (code.includes("setup_failed") || code.includes("provision_result_error")) {
    return "pending_connection";
  }
  return "pending_connection";
}

function asDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) {
    return null;
  }
  const parsed = new Date(text.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function extractExpiry(object: Record<string, unknown>): Date | null {
  return (
    asDate(object.expiry_date) ??
    asDate(object.expiry_datetime) ??
    asDate(object.expires_at) ??
    asDate(object.next_due_date) ??
    asDate(object.paid_until) ??
    asDate(object.renewal_date)
  );
}

export function extractAutoRenew(object: Record<string, unknown>): boolean | null {
  const value =
    object.auto_renew ?? object.autoRenew ?? object.renew_on ?? object.renewOn;
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === 0 || value === "0" || value === "false") {
    return false;
  }
  return null;
}
