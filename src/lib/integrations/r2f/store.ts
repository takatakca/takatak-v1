import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";

import type { R2FLeadRequest } from "./types";

type TransactionClient = Pick<
  Prisma.TransactionClient,
  "sourceSynchronizationEvent" | "leadSource" | "lead" | "auditLog" | "notification"
>;

export interface R2FLeadStoreDb {
  $transaction<T>(
    fn: (transaction: TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
}

const SOURCE_NAME = "R2F RAPIDE2FIX";
const FLOOD_WINDOW_MS = 10 * 60 * 1000;
const FLOOD_LIMIT = 100;
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

export class R2FRateLimitedError extends Error {
  constructor() {
    super("R2F lead intake is temporarily rate limited.");
    this.name = "R2FRateLimitedError";
  }
}

export class R2FEventConflictError extends Error {
  constructor() {
    super("R2F event id was already used with a different payload.");
    this.name = "R2FEventConflictError";
  }
}

export interface R2FLeadResult {
  leadId: string;
  reference: string;
  duplicate: boolean;
}

function hashPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

function referenceFor(leadId: string): string {
  return leadId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function subjectOf(request: R2FLeadRequest): string {
  return `R2F request: ${request.project.serviceCategory} · ${request.project.city}`;
}

function composeMessage(request: R2FLeadRequest): string {
  const p = request.project;
  return [
    subjectOf(request),
    `Need: ${p.needType}`,
    `Market: ${p.market}`,
    `Property: ${p.propertyType}`,
    `Urgency: ${p.urgency}`,
    `Location: ${p.city} · ${p.postalCode}`,
    p.serviceSubcategory ? `Subcategory: ${p.serviceSubcategory}` : null,
    p.problemType ? `Problem: ${p.problemType}` : null,
    "",
    p.description,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
    .slice(0, 5000);
}

export async function recordR2FLeadWithDb(
  db: R2FLeadStoreDb,
  request: R2FLeadRequest,
  rawBody: string,
  clientId: string,
  now = new Date(),
): Promise<R2FLeadResult> {
  const payloadHash = hashPayload(rawBody);
  const synchronizationEventId = `r2f:${request.requestId}`;
  return db.$transaction(
    async (tx) => {
      const previousEvent = await tx.sourceSynchronizationEvent.findUnique({
        where: { eventId: synchronizationEventId },
      });

      if (previousEvent) {
        if (previousEvent.payloadHash !== payloadHash) {
          throw new R2FEventConflictError();
        }

        const previous = previousEvent.responsePayload as
          | { leadId?: unknown; reference?: unknown }
          | null;

        if (
          previous &&
          typeof previous.leadId === "string" &&
          typeof previous.reference === "string"
        ) {
          return {
            leadId: previous.leadId,
            reference: previous.reference,
            duplicate: true,
          };
        }

        throw new Error("r2f_previous_event_incomplete");
      }

      let source = await tx.leadSource.findFirst({
        where: {
          clientId,
          type: "website_form",
          name: SOURCE_NAME,
        },
        select: { id: true },
      });

      if (!source) {
        source = await tx.leadSource.create({
          data: {
            clientId,
            name: SOURCE_NAME,
            type: "website_form",
            provider: "manual",
            status: "active_internal",
            metadata: {
              product: "r2f",
              repository: "takatakca/r2fca",
              purpose: "property_service_lead_intake",
            },
          },
          select: { id: true },
        });
      }

      const recentCount = await tx.lead.count({
        where: {
          clientId,
          leadSourceId: source.id,
          createdAt: {
            gte: new Date(now.getTime() - FLOOD_WINDOW_MS),
          },
        },
      });
      if (recentCount >= FLOOD_LIMIT) {
        throw new R2FRateLimitedError();
      }

      const subject = subjectOf(request);
      const contactFilters: Prisma.LeadWhereInput[] = [];
      if (request.contact.email) {
        contactFilters.push({ email: request.contact.email });
      }
      if (request.contact.phone) {
        contactFilters.push({ phone: request.contact.phone });
      }

      const duplicateLead =
        contactFilters.length > 0
          ? await tx.lead.findFirst({
              where: {
                clientId,
                leadSourceId: source.id,
                createdAt: {
                  gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS),
                },
                OR: contactFilters,
                message: { startsWith: subject },
              },
              select: { id: true },
            })
          : null;

      if (duplicateLead) {
        const response = {
          leadId: duplicateLead.id,
          reference: referenceFor(duplicateLead.id),
          duplicate: true,
        };

        await tx.sourceSynchronizationEvent.create({
          data: {
            eventId: synchronizationEventId,
            eventType: "R2F_LEAD_SUBMITTED",
            sourceApplication: "r2f",
            payloadHash,
            responsePayload: response as Prisma.InputJsonValue,
            status: "PROCESSED",
            processedAt: now,
          },
        });

        return response;
      }

      const lead = await tx.lead.create({
        data: {
          clientId,
          leadSourceId: source.id,
          name: `${request.contact.firstName} ${request.contact.lastName}`.trim(),
          email: request.contact.email,
          phone: request.contact.phone,
          message: composeMessage(request),
          status: "new_internal",
          priority: request.project.urgency === "urgent" ? "high" : "normal",
          valueCents: request.project.budgetCents,
          currency: "CAD",
          metadata: {
            origin: "r2f",
            product: "r2f",
            requestId: request.requestId,
            language: request.contact.preferredLanguage,
            project: request.project,
            attribution: request.attribution,
            consent: request.consent,
            identityResolution: "not_attempted_unverified_contact",
          } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      const response = {
        leadId: lead.id,
        reference: referenceFor(lead.id),
        duplicate: false,
      };

      await tx.auditLog.create({
        data: {
          clientId,
          action: "r2f_lead_received",
          entityType: "Lead",
          entityId: lead.id,
          metadata: {
            product: "r2f",
            requestId: request.requestId,
          },
        },
      });

      await tx.notification.create({
        data: {
          clientId,
          type: "system",
          title: "New R2F request",
          message: `${request.project.serviceCategory} · ${request.project.city} · Ref ${response.reference}`.slice(
            0,
            500,
          ),
          relatedEntityType: "lead",
          relatedEntityId: lead.id,
        },
      });

      await tx.sourceSynchronizationEvent.create({
        data: {
          eventId: synchronizationEventId,
          eventType: "R2F_LEAD_SUBMITTED",
          sourceApplication: "r2f",
          payloadHash,
          responsePayload: response as Prisma.InputJsonValue,
          status: "PROCESSED",
          processedAt: now,
        },
      });

      return response;
    },
    {
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}

export async function recordR2FLead(
  request: R2FLeadRequest,
  rawBody: string,
  clientId: string,
): Promise<R2FLeadResult> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  return recordR2FLeadWithDb(
    prisma,
    request,
    rawBody,
    clientId,
  );
}
