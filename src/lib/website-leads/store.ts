// Persists a validated public website request as a Lead in the TAKATAK
// agency workspace, so it appears in /dashboard/leads. One transaction:
// ensure the website LeadSource, enforce a workspace-wide flood cap, collapse
// rapid duplicates, create the Lead and an audit entry.

import type { Prisma } from "@prisma/client";

import type { PricedPackageOrder } from "./package-pricing";
import type { WebsiteRequestInput } from "./validation";

export const WEBSITE_LEAD_SOURCE_NAME = "takatak.ca website";
export const FLOOD_WINDOW_MS = 10 * 60 * 1000;
export const FLOOD_LIMIT = 40;
export const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

export class WebsiteLeadRateLimitedError extends Error {
  constructor() {
    super("Website lead intake is temporarily rate limited.");
    this.name = "WebsiteLeadRateLimitedError";
  }
}

type TransactionClient = Pick<
  Prisma.TransactionClient,
  "leadSource" | "lead" | "auditLog"
>;

export interface LeadStoreDb {
  $transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export interface RecordWebsiteRequestInput {
  clientId: string;
  request: WebsiteRequestInput;
  authUserId: string | null;
  sourceHash: string;
  /** Required for package orders: catalog-priced by the server. */
  pricedOrder?: PricedPackageOrder | null;
  now?: Date;
}

export interface RecordedWebsiteRequest {
  leadId: string;
  reference: string;
  duplicate: boolean;
}

export function referenceFor(leadId: string): string {
  return leadId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function cad(cents: number): string {
  return `$${(cents / 100).toFixed(2)} CAD`;
}

function subjectOf(request: WebsiteRequestInput, order: PricedPackageOrder | null | undefined): string {
  if (request.kind === "domain_request") return `Domain request: ${request.domain?.fqdn ?? ""}`;
  if (request.kind === "package_order") {
    return `Package order: ${order?.title ?? request.order?.packageId ?? ""} (${order?.tierName ?? request.order?.tierName ?? ""})`;
  }
  return `Project request: ${request.project?.title ?? ""}`;
}

function composeMessage(request: WebsiteRequestInput, order: PricedPackageOrder | null | undefined): string {
  const lines = [subjectOf(request, order)];
  if (order) {
    lines.push(`Tier: ${order.tierName} · ${order.deliveryDays}-day delivery · ${cad(order.tierPriceCents)}`);
    for (const addon of order.addons) lines.push(`Add-on: ${addon.label} · ${cad(addon.priceCents)}`);
    if (order.discountCents > 0) lines.push(`Promo ${order.promoCode}: -${cad(order.discountCents)}`);
    lines.push(`Total quoted (catalog price, not charged): ${cad(order.totalCents)}`);
  }
  if (request.project?.category) lines.push(`Category: ${request.project.category}`);
  if (request.project?.timeline) lines.push(`Timeline: ${request.project.timeline}`);
  if (request.message) lines.push("", request.message);
  return lines.join("\n").slice(0, 5000);
}

export async function recordWebsiteRequest(
  db: LeadStoreDb,
  input: RecordWebsiteRequestInput,
): Promise<RecordedWebsiteRequest> {
  const now = input.now ?? new Date();
  const { request, clientId } = input;
  const order = request.kind === "package_order" ? input.pricedOrder ?? null : null;
  if (request.kind === "package_order" && !order) throw new Error("package_order_not_priced");
  const subject = subjectOf(request, order);

  return db.$transaction(async (tx) => {
    let source = await tx.leadSource.findFirst({
      where: { clientId, type: "website_form", name: WEBSITE_LEAD_SOURCE_NAME },
      select: { id: true },
    });
    if (!source) {
      source = await tx.leadSource.create({
        data: {
          clientId,
          name: WEBSITE_LEAD_SOURCE_NAME,
          type: "website_form",
          provider: "manual",
          status: "active_internal",
          metadata: { note: "Public takatak.ca website forms." },
        },
        select: { id: true },
      });
    }

    const recentCount = await tx.lead.count({
      where: {
        clientId,
        leadSourceId: source.id,
        createdAt: { gte: new Date(now.getTime() - FLOOD_WINDOW_MS) },
      },
    });
    if (recentCount >= FLOOD_LIMIT) throw new WebsiteLeadRateLimitedError();

    const contactFilters: Prisma.LeadWhereInput[] = [];
    if (request.email) contactFilters.push({ email: request.email });
    if (request.phone) contactFilters.push({ phone: request.phone });

    if (contactFilters.length) {
      const duplicate = await tx.lead.findFirst({
        where: {
          clientId,
          leadSourceId: source.id,
          createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
          OR: contactFilters,
          message: { startsWith: subject },
        },
        select: { id: true },
      });
      if (duplicate) {
        return {
          leadId: duplicate.id,
          reference: referenceFor(duplicate.id),
          duplicate: true,
        };
      }
    }

    const lead = await tx.lead.create({
      data: {
        clientId,
        leadSourceId: source.id,
        name: request.name,
        email: request.email,
        phone: request.phone,
        company: request.company,
        message: composeMessage(request, order),
        status: "new_internal",
        priority: order ? "high" : "normal",
        valueCents: order ? order.totalCents : request.project?.budgetCents ?? null,
        currency: "CAD",
        metadata: {
          origin: "takatak_website",
          kind: request.kind,
          language: request.language,
          sourcePage: request.sourcePage,
          domain: request.domain,
          project: request.project,
          order,
          authenticated: Boolean(input.authUserId),
          authUserId: input.authUserId,
          sourceHash: input.sourceHash,
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        clientId,
        action: "website_request_received",
        entityType: "Lead",
        entityId: lead.id,
        metadata: { note: `Public website ${request.kind.replace("_", " ")}.` },
      },
    });

    return { leadId: lead.id, reference: referenceFor(lead.id), duplicate: false };
  });
}
