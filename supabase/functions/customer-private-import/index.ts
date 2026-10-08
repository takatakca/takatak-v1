import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type CustomerRow = {
  externalKey: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  normalizedEmail?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  evidenceStatus?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ReservationRow = {
  reservationNumber: string;
  customerExternalKey?: string | null;
  sourceSystem: string;
  customerEmail?: string | null;
  accommodationCode?: string | null;
  accommodationType?: string | null;
  arrivalDate?: string | null;
  departureDate?: string | null;
  nights?: number | null;
  adults?: number | null;
  children?: number | null;
  statusText?: string | null;
  totalMinor?: number | null;
  paidMinor?: number | null;
  balanceMinor?: number | null;
  currency?: string | null;
  sourceDate?: string | null;
  sourceMessageId?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

type InteractionRow = {
  externalKey: string;
  customerEmail?: string | null;
  occurredAt?: string | null;
  direction?: string | null;
  channel?: string | null;
  subject?: string | null;
  snippet?: string | null;
  sourceAccount?: string | null;
  sourceMessageId?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

type EvidenceRow = {
  externalKey: string;
  customerExternalKey?: string | null;
  customerEmail?: string | null;
  reservationNumber?: string | null;
  reservationSourceSystem?: string | null;
  sourceType: string;
  sourceSystem: string;
  sourceAccount?: string | null;
  sourceRecordId?: string | null;
  sourceDate?: string | null;
  subject?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

type BatchRow = {
  sourceName: string;
  sourceFileSha256: string;
  status?: string | null;
  sourcePeriodStart?: string | null;
  sourcePeriodEnd?: string | null;
  customerRows?: number | null;
  reservationRows?: number | null;
  evidenceRows?: number | null;
  interactionRows?: number | null;
  importedAt?: string | null;
};

type ImportBody = {
  clientId: string;
  businessBrandId?: string | null;
  kind: "customers" | "reservations" | "interactions" | "evidence" | "batch";
  rows: Array<CustomerRow | ReservationRow | InteractionRow | EvidenceRow | BatchRow>;
};

function secretKey(): string {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    const parsed = JSON.parse(modern) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase secret key is unavailable.");
  return legacy;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

function cleanString(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const importToken = req.headers.get("x-takatak-import-token");
  if (!importToken || importToken.length < 24) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    !body?.clientId ||
    !body?.kind ||
    !Array.isArray(body.rows) ||
    body.rows.length === 0 ||
    body.rows.length > 500
  ) {
    return Response.json({ error: "invalid_import_batch" }, { status: 400 });
  }

  const tokenHash = await sha256(importToken);
  const { data: authorization, error: authorizationError } = await supabase
    .from("customer_import_authorizations")
    .select("id,clientId,status,expiresAt,usedAt")
    .eq("tokenHash", tokenHash)
    .eq("clientId", body.clientId)
    .eq("status", "active")
    .is("usedAt", null)
    .gt("expiresAt", new Date().toISOString())
    .maybeSingle();

  if (authorizationError || !authorization) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const brandId = body.businessBrandId ?? null;

  const customerEmailMap = async (emails: Array<string | null>) => {
    const unique = Array.from(new Set(emails.filter((value): value is string => Boolean(value))));
    if (!unique.length) return new Map<string, string>();
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("id,normalizedEmail")
      .eq("clientId", body.clientId)
      .in("normalizedEmail", unique);
    if (error) throw error;
    return new Map(
      (data ?? [])
        .filter((row) => row.normalizedEmail)
        .map((row) => [row.normalizedEmail as string, row.id as string]),
    );
  };

  const customerExternalKeyMap = async (keys: Array<string | null | undefined>) => {
    const unique = Array.from(
      new Set(keys.filter((value): value is string => Boolean(value))),
    );
    if (!unique.length) return new Map<string, string>();
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("id,externalKey")
      .eq("clientId", body.clientId)
      .in("externalKey", unique);
    if (error) throw error;
    return new Map(
      (data ?? []).map((row) => [row.externalKey as string, row.id as string]),
    );
  };

  try {
    if (body.kind === "customers") {
      const rows = (body.rows as CustomerRow[]).map((row) => ({
        id: crypto.randomUUID(),
        clientId: body.clientId,
        businessBrandId: brandId,
        externalKey: row.externalKey,
        displayName: cleanString(row.displayName, 500),
        firstName: cleanString(row.firstName, 250),
        lastName: cleanString(row.lastName, 250),
        email: cleanString(row.email, 500),
        normalizedEmail: normalizeEmail(row.normalizedEmail ?? row.email),
        phone: cleanString(row.phone, 500),
        normalizedPhone: cleanString(row.normalizedPhone, 100),
        addressLine1: cleanString(row.addressLine1, 1000),
        addressLine2: cleanString(row.addressLine2, 1000),
        city: cleanString(row.city, 500),
        region: cleanString(row.region, 500),
        postalCode: cleanString(row.postalCode, 100),
        country: cleanString(row.country, 250),
        evidenceStatus: cleanString(row.evidenceStatus, 250) ?? "observed",
        firstSeenAt: row.firstSeenAt ?? null,
        lastSeenAt: row.lastSeenAt ?? null,
        metadata: row.metadata ?? null,
        updatedAt: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("customer_profiles")
        .upsert(rows, { onConflict: "clientId,externalKey" });
      if (error) throw error;
    }

    if (body.kind === "reservations") {
      const sourceRows = body.rows as ReservationRow[];
      const emails = sourceRows.map((row) => normalizeEmail(row.customerEmail));
      const customers = await customerEmailMap(emails);
      const externalCustomers = await customerExternalKeyMap(sourceRows.map((row) => row.customerExternalKey));
      const rows = sourceRows.map((row, index) => ({
        id: crypto.randomUUID(),
        clientId: body.clientId,
        businessBrandId: brandId,
        customerProfileId: (emails[index] ? customers.get(emails[index]!) : undefined) ?? (row.customerExternalKey ? externalCustomers.get(row.customerExternalKey) : undefined) ?? null,
        reservationNumber: row.reservationNumber,
        sourceSystem: row.sourceSystem,
        accommodationCode: cleanString(row.accommodationCode, 500),
        accommodationType: cleanString(row.accommodationType, 500),
        arrivalDate: row.arrivalDate ?? null,
        departureDate: row.departureDate ?? null,
        nights: row.nights ?? null,
        adults: row.adults ?? null,
        children: row.children ?? null,
        statusText: cleanString(row.statusText, 500),
        totalMinor: row.totalMinor ?? null,
        paidMinor: row.paidMinor ?? null,
        balanceMinor: row.balanceMinor ?? null,
        currency: cleanString(row.currency, 10) ?? "CAD",
        sourceDate: row.sourceDate ?? null,
        sourceMessageId: cleanString(row.sourceMessageId, 500),
        sourceUrl: cleanString(row.sourceUrl, 4000),
        metadata: row.metadata ?? null,
        updatedAt: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("customer_reservations")
        .upsert(rows, { onConflict: "clientId,sourceSystem,reservationNumber" });
      if (error) throw error;
    }

    if (body.kind === "interactions") {
      const sourceRows = body.rows as InteractionRow[];
      const emails = sourceRows.map((row) => normalizeEmail(row.customerEmail));
      const customers = await customerEmailMap(emails);
      const rows = sourceRows.map((row, index) => ({
        id: crypto.randomUUID(),
        clientId: body.clientId,
        customerProfileId: emails[index] ? customers.get(emails[index]!) ?? null : null,
        externalKey: row.externalKey,
        occurredAt: row.occurredAt ?? null,
        direction: cleanString(row.direction, 100),
        channel: cleanString(row.channel, 100) ?? "email",
        subject: cleanString(row.subject, 2000),
        snippet: cleanString(row.snippet, 4000),
        sourceAccount: cleanString(row.sourceAccount, 500),
        sourceMessageId: cleanString(row.sourceMessageId, 500),
        sourceUrl: cleanString(row.sourceUrl, 4000),
        metadata: row.metadata ?? null,
      }));
      const { error } = await supabase
        .from("customer_interactions")
        .upsert(rows, { onConflict: "clientId,externalKey" });
      if (error) throw error;
    }

    if (body.kind === "evidence") {
      const sourceRows = body.rows as EvidenceRow[];
      const emails = sourceRows.map((row) => normalizeEmail(row.customerEmail));
      const customers = await customerEmailMap(emails);
      const externalCustomers = await customerExternalKeyMap(sourceRows.map((row) => row.customerExternalKey));

      const reservationKeys = sourceRows
        .filter((row) => row.reservationNumber && row.reservationSourceSystem)
        .map((row) => ({
          reservationNumber: row.reservationNumber!,
          sourceSystem: row.reservationSourceSystem!,
        }));

      const reservationMap = new Map<string, string>();
      for (const key of reservationKeys) {
        const { data } = await supabase
          .from("customer_reservations")
          .select("id")
          .eq("clientId", body.clientId)
          .eq("sourceSystem", key.sourceSystem)
          .eq("reservationNumber", key.reservationNumber)
          .maybeSingle();
        if (data?.id) {
          reservationMap.set(`${key.sourceSystem}:${key.reservationNumber}`, data.id);
        }
      }

      const rows = sourceRows.map((row, index) => ({
        id: crypto.randomUUID(),
        clientId: body.clientId,
        customerProfileId: (emails[index] ? customers.get(emails[index]!) : undefined) ?? (row.customerExternalKey ? externalCustomers.get(row.customerExternalKey) : undefined) ?? null,
        customerReservationId:
          row.reservationNumber && row.reservationSourceSystem
            ? reservationMap.get(
                `${row.reservationSourceSystem}:${row.reservationNumber}`,
              ) ?? null
            : null,
        externalKey: row.externalKey,
        sourceType: row.sourceType,
        sourceSystem: row.sourceSystem,
        sourceAccount: cleanString(row.sourceAccount, 500),
        sourceRecordId: cleanString(row.sourceRecordId, 500),
        sourceDate: row.sourceDate ?? null,
        subject: cleanString(row.subject, 2000),
        sourceUrl: cleanString(row.sourceUrl, 4000),
        metadata: row.metadata ?? null,
      }));
      const { error } = await supabase
        .from("customer_source_evidence")
        .upsert(rows, { onConflict: "clientId,externalKey" });
      if (error) throw error;
    }

    if (body.kind === "batch") {
      const rows = (body.rows as BatchRow[]).map((row) => ({
        id: crypto.randomUUID(),
        clientId: body.clientId,
        businessBrandId: brandId,
        sourceName: row.sourceName,
        sourceFileSha256: row.sourceFileSha256,
        status: row.status ?? "imported",
        sourcePeriodStart: row.sourcePeriodStart ?? null,
        sourcePeriodEnd: row.sourcePeriodEnd ?? null,
        customerRows: row.customerRows ?? 0,
        reservationRows: row.reservationRows ?? 0,
        evidenceRows: row.evidenceRows ?? 0,
        interactionRows: row.interactionRows ?? 0,
        importedAt: row.importedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("customer_import_batches")
        .upsert(rows, { onConflict: "clientId,sourceFileSha256" });
      if (error) throw error;
    }

    return Response.json({ ok: true, kind: body.kind, rows: body.rows.length });
  } catch (error) {
    console.error("[customer-private-import] batch failed", {
      kind: body.kind,
      rows: body.rows.length,
      error: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "import_failed" }, { status: 500 });
  }
});
