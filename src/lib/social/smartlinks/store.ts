import "server-only";

import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

import {
  canPublishSmartLink,
  smartLinkStatDay,
  smartLinkStatKey,
  type SmartLinkInput,
  type SmartLinkStatus,
} from "./policy";

// SmartLinks storage. Every read and write is scoped to one workspace (clientId)
// and one brand; the public page only ever sees published pages. Until the
// owner applies the SmartLinks migration, the tables do not exist and every
// call reports "not activated" instead of failing.

export const SMARTLINKS_NOT_ACTIVATED =
  "SmartLinks are not activated yet: the SmartLinks database migration still has to be applied.";

export interface SmartLinkButtonView {
  id: string;
  label: string;
  url: string;
  clicks30d: number;
}

export interface SmartLinkView {
  id: string;
  slug: string;
  title: string;
  bio: string;
  status: SmartLinkStatus;
  publishedAt: string | null;
  updatedAt: string;
  views30d: number;
  clicks30d: number;
  buttons: SmartLinkButtonView[];
}

export interface PublicSmartLink {
  id: string;
  clientId: string;
  slug: string;
  title: string;
  bio: string;
  brandName: string;
  buttons: { id: string; label: string }[];
}

function missingTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

function db() {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "The database is not available.");
  return prisma;
}

/** Runs a storage call; a missing SmartLinks table becomes a clear "not activated" error. */
async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (missingTable(error)) throw new ServiceError("unavailable", SMARTLINKS_NOT_ACTIVATED, { status: 503 });
    throw error;
  }
}

function daysAgo(days: number, now = new Date()): Date {
  const day = new Date(`${smartLinkStatDay(now)}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - days);
  return day;
}

/** True once the SmartLinks tables exist (the migration has been applied). */
export async function smartLinksActivated(): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;
  try {
    await prisma.socialSmartLink.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (missingTable(error)) return false;
    throw error;
  }
}

export async function listSmartLinks(input: { clientId: string; businessBrandId: string }): Promise<SmartLinkView[]> {
  return guarded(async () => {
    const prisma = db();
    const links = await prisma.socialSmartLink.findMany({
      where: { clientId: input.clientId, businessBrandId: input.businessBrandId },
      orderBy: { createdAt: "desc" },
      include: { buttons: { orderBy: { position: "asc" } } },
    });
    if (!links.length) return [];
    const stats = await prisma.socialSmartLinkDailyStat.groupBy({
      by: ["smartLinkId", "statKey"],
      where: { clientId: input.clientId, smartLinkId: { in: links.map((link) => link.id) }, day: { gte: daysAgo(29) } },
      _sum: { count: true },
    });
    const total = (linkId: string, key: string) =>
      stats.find((row) => row.smartLinkId === linkId && row.statKey === key)?._sum.count ?? 0;
    return links.map((link) => {
      const buttons = link.buttons.map((button) => ({
        id: button.id,
        label: button.label,
        url: button.url,
        clicks30d: total(link.id, smartLinkStatKey(button.id)),
      }));
      return {
        id: link.id,
        slug: link.slug,
        title: link.title,
        bio: link.bio,
        status: link.status === "published" ? "published" : "draft",
        publishedAt: link.publishedAt?.toISOString() ?? null,
        updatedAt: link.updatedAt.toISOString(),
        views30d: total(link.id, smartLinkStatKey(null)),
        clicks30d: buttons.reduce((sum, button) => sum + button.clicks30d, 0),
        buttons,
      };
    });
  });
}

async function slugTaken(slug: string, exceptId: string | null): Promise<boolean> {
  const existing = await db().socialSmartLink.findUnique({ where: { slug }, select: { id: true } });
  return Boolean(existing && existing.id !== exceptId);
}

function slugConflict(): ServiceError {
  return new ServiceError("conflict", "This address is already used. Choose another one.", {
    fieldErrors: { slug: "taken" },
  });
}

export async function createSmartLink(input: {
  clientId: string;
  businessBrandId: string;
  profileId: string | null;
  value: SmartLinkInput;
}): Promise<{ id: string }> {
  return guarded(async () => {
    const prisma = db();
    const brand = await prisma.businessBrand.findFirst({
      where: { id: input.businessBrandId, clientId: input.clientId },
      select: { id: true },
    });
    if (!brand) throw new ServiceError("not_found", "This brand was not found in the workspace.");
    if (await slugTaken(input.value.slug, null)) throw slugConflict();
    try {
      const link = await prisma.socialSmartLink.create({
        data: {
          clientId: input.clientId,
          businessBrandId: input.businessBrandId,
          slug: input.value.slug,
          title: input.value.title,
          bio: input.value.bio,
          createdByProfileId: input.profileId,
          buttons: {
            create: input.value.buttons.map((button, position) => ({
              clientId: input.clientId,
              label: button.label,
              url: button.url,
              position,
            })),
          },
        },
        select: { id: true },
      });
      return link;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw slugConflict();
      throw error;
    }
  });
}

async function ownedLink(clientId: string, businessBrandId: string, id: string) {
  const link = await db().socialSmartLink.findFirst({
    where: { id, clientId, businessBrandId },
    select: { id: true, status: true },
  });
  if (!link) throw new ServiceError("not_found", "This SmartLink was not found.");
  return link;
}

export async function updateSmartLink(input: {
  clientId: string;
  businessBrandId: string;
  id: string;
  value: SmartLinkInput;
}): Promise<void> {
  await guarded(async () => {
    const prisma = db();
    const link = await ownedLink(input.clientId, input.businessBrandId, input.id);
    if (await slugTaken(input.value.slug, link.id)) throw slugConflict();
    if (link.status === "published" && !canPublishSmartLink(input.value.buttons.length)) {
      throw new ServiceError("invalid_input", "A published page needs at least one button.", {
        fieldErrors: { buttons: "required" },
      });
    }
    const existing = await prisma.socialSmartLinkButton.findMany({ where: { smartLinkId: link.id }, select: { id: true } });
    const existingIds = new Set(existing.map((button) => button.id));
    const keptIds = new Set(input.value.buttons.map((button) => button.id).filter((id): id is string => Boolean(id && existingIds.has(id))));
    try {
      await prisma.$transaction([
        prisma.socialSmartLink.update({
          where: { id: link.id },
          data: { slug: input.value.slug, title: input.value.title, bio: input.value.bio },
        }),
        prisma.socialSmartLinkButton.deleteMany({ where: { smartLinkId: link.id, id: { notIn: [...keptIds] } } }),
        ...input.value.buttons.map((button, position) =>
          button.id && keptIds.has(button.id)
            ? prisma.socialSmartLinkButton.update({
                where: { id: button.id },
                data: { label: button.label, url: button.url, position },
              })
            : prisma.socialSmartLinkButton.create({
                data: { smartLinkId: link.id, clientId: input.clientId, label: button.label, url: button.url, position },
              }),
        ),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw slugConflict();
      throw error;
    }
  });
}

export async function setSmartLinkStatus(input: {
  clientId: string;
  businessBrandId: string;
  id: string;
  status: SmartLinkStatus;
}): Promise<void> {
  await guarded(async () => {
    const prisma = db();
    const link = await ownedLink(input.clientId, input.businessBrandId, input.id);
    if (input.status === "published") {
      const buttons = await prisma.socialSmartLinkButton.count({ where: { smartLinkId: link.id } });
      if (!canPublishSmartLink(buttons)) {
        throw new ServiceError("invalid_input", "Add at least one button before publishing.", {
          fieldErrors: { buttons: "required" },
        });
      }
    }
    await prisma.socialSmartLink.update({
      where: { id: link.id },
      data: { status: input.status, publishedAt: input.status === "published" ? new Date() : null },
    });
  });
}

export async function deleteSmartLink(input: { clientId: string; businessBrandId: string; id: string }): Promise<void> {
  await guarded(async () => {
    const link = await ownedLink(input.clientId, input.businessBrandId, input.id);
    await db().socialSmartLink.delete({ where: { id: link.id } });
  });
}

/** The public page for /l/<slug>: published pages only; null otherwise (or before activation). */
export async function getPublishedSmartLink(slug: string): Promise<PublicSmartLink | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    const link = await prisma.socialSmartLink.findFirst({
      where: { slug, status: "published" },
      include: {
        buttons: { orderBy: { position: "asc" }, select: { id: true, label: true } },
        businessBrand: { select: { name: true } },
      },
    });
    if (!link) return null;
    return {
      id: link.id,
      clientId: link.clientId,
      slug: link.slug,
      title: link.title,
      bio: link.bio,
      brandName: link.businessBrand.name,
      buttons: link.buttons,
    };
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
}

/** Where a public button leads, only for a published page and one of its own buttons. */
export async function getSmartLinkButtonTarget(
  slug: string,
  buttonId: string,
): Promise<{ url: string; smartLinkId: string; clientId: string } | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    const button = await prisma.socialSmartLinkButton.findFirst({
      where: { id: buttonId, smartLink: { slug, status: "published" } },
      select: { url: true, smartLinkId: true, clientId: true },
    });
    return button;
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
}

/** Adds one to today's counter for the page (views) or a button (clicks). Never stores who the visitor is. */
export async function countSmartLinkEvent(input: {
  smartLinkId: string;
  clientId: string;
  buttonId: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  const day = new Date(`${smartLinkStatDay()}T00:00:00.000Z`);
  const statKey = smartLinkStatKey(input.buttonId);
  try {
    await prisma.socialSmartLinkDailyStat.upsert({
      where: { smartLinkId_statKey_day: { smartLinkId: input.smartLinkId, statKey, day } },
      create: { smartLinkId: input.smartLinkId, clientId: input.clientId, statKey, day, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    // A lost counter must never block a visitor.
  }
}
