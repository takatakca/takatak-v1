import "server-only";

// Web chat — public visitor endpoints and tenant-scoped staff inbox.
// A visitor is identified only by a random token they hold; we store its hash.

import { createHash, randomBytes } from "node:crypto";

import { originAllowed, originsForDomain, normalizeSiteDomain } from "@/lib/analytics/parse";
import { getPrisma } from "@/lib/db/prisma";

export const MAX_MESSAGE_CHARS = 2000;
const VISITOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  return prisma;
}

function hashVisitorToken(token: string): string {
  return createHash("sha256").update(`chat:${token}`).digest("hex");
}

export function cleanMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (!body) return null;
  return body.slice(0, MAX_MESSAGE_CHARS);
}

function cleanOptional(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
}

// ------------------------------------------------------------------ public

export interface PublicWidget {
  id: string;
  clientId: string;
  name: string;
  greeting: string | null;
  accentColor: string;
  whatsappNumber: string | null;
}

export async function publicWidget(publicKey: string, origin: string | null): Promise<PublicWidget | null> {
  if (!/^tc_[A-Za-z0-9_-]{24}$/.test(publicKey)) return null;
  const widget = await requirePrisma().chatWidget.findUnique({
    where: { publicKey },
    select: { id: true, clientId: true, name: true, greeting: true, accentColor: true, whatsappNumber: true, active: true, allowedOrigins: true },
  });
  if (!widget || !widget.active || !originAllowed(origin, widget.allowedOrigins)) return null;
  return {
    id: widget.id,
    clientId: widget.clientId,
    name: widget.name,
    greeting: widget.greeting,
    accentColor: widget.accentColor,
    whatsappNumber: widget.whatsappNumber,
  };
}

export interface VisitorMessage {
  id: string;
  sender: "visitor" | "staff" | "ai" | "system";
  body: string;
  createdAt: string;
}

export async function visitorSend(
  widget: PublicWidget,
  input: { visitorToken: string | null; body: string; name: unknown; email: unknown; phone: unknown; pageUrl: unknown },
): Promise<{ visitorToken: string; message: VisitorMessage } | { error: "closed" | "unknown_conversation" }> {
  const prisma = requirePrisma();
  const providedToken = input.visitorToken && VISITOR_TOKEN_PATTERN.test(input.visitorToken) ? input.visitorToken : null;

  return prisma.$transaction(async (tx) => {
    let conversation = providedToken
      ? await tx.chatConversation.findUnique({
          where: { visitorTokenHash: hashVisitorToken(providedToken) },
          select: { id: true, widgetId: true, status: true },
        })
      : null;
    if (providedToken && (!conversation || conversation.widgetId !== widget.id)) return { error: "unknown_conversation" as const };
    if (conversation?.status === "closed") return { error: "closed" as const };

    let token = providedToken;
    if (!conversation) {
      token = randomBytes(32).toString("base64url");
      conversation = await tx.chatConversation.create({
        data: {
          clientId: widget.clientId,
          widgetId: widget.id,
          visitorTokenHash: hashVisitorToken(token),
          visitorName: cleanOptional(input.name, 80),
          visitorEmail: cleanOptional(input.email, 254),
          visitorPhone: cleanOptional(input.phone, 32),
          pageUrl: cleanOptional(input.pageUrl, 500),
        },
        select: { id: true, widgetId: true, status: true },
      });
    }

    const message = await tx.chatMessage.create({
      data: { conversationId: conversation.id, clientId: widget.clientId, sender: "visitor", body: input.body },
      select: { id: true, sender: true, body: true, createdAt: true },
    });
    await tx.chatConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt, unreadForStaff: { increment: 1 } },
    });
    return { visitorToken: token!, message: { ...message, createdAt: message.createdAt.toISOString() } };
  });
}

export async function visitorMessages(
  widget: PublicWidget,
  visitorToken: string,
  after: string | null,
): Promise<{ status: "open" | "closed"; messages: VisitorMessage[] } | null> {
  if (!VISITOR_TOKEN_PATTERN.test(visitorToken)) return null;
  const prisma = requirePrisma();
  const conversation = await prisma.chatConversation.findUnique({
    where: { visitorTokenHash: hashVisitorToken(visitorToken) },
    select: { id: true, widgetId: true, status: true },
  });
  if (!conversation || conversation.widgetId !== widget.id) return null;
  const afterDate = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : null;
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id, ...(afterDate ? { createdAt: { gt: afterDate } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, sender: true, body: true, createdAt: true },
  });
  return { status: conversation.status, messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })) };
}

// ------------------------------------------------------------------- staff

export function newWidgetPublicKey(): string {
  return `tc_${randomBytes(18).toString("base64url")}`;
}

export async function createChatWidget(
  clientId: string,
  input: { name: unknown; domain: unknown; greeting: unknown; accentColor: unknown; whatsappNumber: unknown; businessBrandId: unknown },
): Promise<{ id: string; publicKey: string } | { error: string }> {
  const name = cleanOptional(input.name, 80);
  if (!name || name.length < 2) return { error: "Name the chat (usually the business name)." };
  const domain = normalizeSiteDomain(typeof input.domain === "string" ? input.domain : "");
  if (!domain) return { error: "Enter the website domain where the chat will appear." };
  const accent = typeof input.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(input.accentColor) ? input.accentColor : "#4f46e5";
  const whatsappDigits = typeof input.whatsappNumber === "string" ? input.whatsappNumber.replace(/\D/g, "") : "";
  if (whatsappDigits && (whatsappDigits.length < 10 || whatsappDigits.length > 15)) return { error: "WhatsApp number needs 10–15 digits with country code." };
  const brandId = typeof input.businessBrandId === "string" && /^[0-9a-f-]{36}$/i.test(input.businessBrandId) ? input.businessBrandId : null;
  const prisma = requirePrisma();
  if (brandId) {
    const brand = await prisma.businessBrand.findFirst({ where: { id: brandId, clientId }, select: { id: true } });
    if (!brand) return { error: "That brand is not in this workspace." };
  }
  return prisma.chatWidget.create({
    data: {
      clientId,
      businessBrandId: brandId,
      name,
      publicKey: newWidgetPublicKey(),
      allowedOrigins: originsForDomain(domain),
      greeting: cleanOptional(input.greeting, 200),
      accentColor: accent,
      whatsappNumber: whatsappDigits || null,
    },
    select: { id: true, publicKey: true },
  });
}

export interface InboxSnapshot {
  widgets: Array<{ id: string; name: string; publicKey: string; domains: string[]; active: boolean; open: number }>;
  conversations: Array<{
    id: string;
    widgetName: string;
    visitorName: string | null;
    visitorEmail: string | null;
    visitorPhone: string | null;
    status: "open" | "closed";
    unread: number;
    lastMessageAt: Date;
    preview: string | null;
    leadId: string | null;
  }>;
  totals: { open: number; unread: number; today: number };
  brands: Array<{ id: string; name: string }>;
}

export async function getInboxSnapshot(clientId: string, status: "open" | "closed" = "open"): Promise<InboxSnapshot> {
  const prisma = requirePrisma();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [widgets, openCounts, conversations, unread, today, brands] = await Promise.all([
    prisma.chatWidget.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, publicKey: true, allowedOrigins: true, active: true },
    }),
    prisma.chatConversation.groupBy({ by: ["widgetId"], where: { clientId, status: "open" }, _count: { _all: true } }),
    prisma.chatConversation.findMany({
      where: { clientId, status },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      select: {
        id: true,
        visitorName: true,
        visitorEmail: true,
        visitorPhone: true,
        status: true,
        unreadForStaff: true,
        lastMessageAt: true,
        leadId: true,
        widget: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
      },
    }),
    prisma.chatConversation.aggregate({ where: { clientId, status: "open" }, _sum: { unreadForStaff: true }, _count: { _all: true } }),
    prisma.chatConversation.count({ where: { clientId, createdAt: { gte: startOfDay } } }),
    prisma.businessBrand.findMany({ where: { clientId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const openByWidget = new Map(openCounts.map((g) => [g.widgetId, g._count._all]));
  return {
    widgets: widgets.map((w) => ({
      id: w.id,
      name: w.name,
      publicKey: w.publicKey,
      domains: w.allowedOrigins.map((o) => o.replace(/^https?:\/\//, "")),
      active: w.active,
      open: openByWidget.get(w.id) ?? 0,
    })),
    conversations: conversations.map((c) => ({
      id: c.id,
      widgetName: c.widget.name,
      visitorName: c.visitorName,
      visitorEmail: c.visitorEmail,
      visitorPhone: c.visitorPhone,
      status: c.status,
      unread: c.unreadForStaff,
      lastMessageAt: c.lastMessageAt,
      preview: c.messages[0]?.body.slice(0, 140) ?? null,
      leadId: c.leadId,
    })),
    totals: { open: unread._count._all, unread: unread._sum.unreadForStaff ?? 0, today },
    brands,
  };
}

export interface ConversationThread {
  id: string;
  widgetName: string;
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  pageUrl: string | null;
  status: "open" | "closed";
  leadId: string | null;
  createdAt: Date;
  messages: Array<{ id: string; sender: "visitor" | "staff" | "ai" | "system"; body: string; createdAt: Date }>;
}

export async function getConversationThread(clientId: string, conversationId: string): Promise<ConversationThread | null> {
  const prisma = requirePrisma();
  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, clientId },
    select: {
      id: true,
      visitorName: true,
      visitorEmail: true,
      visitorPhone: true,
      pageUrl: true,
      status: true,
      leadId: true,
      createdAt: true,
      widget: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 500, select: { id: true, sender: true, body: true, createdAt: true } },
    },
  });
  if (!conversation) return null;
  await prisma.chatConversation.updateMany({ where: { id: conversationId, clientId }, data: { unreadForStaff: 0 } });
  return { ...conversation, widgetName: conversation.widget.name };
}

export async function staffReply(clientId: string, conversationId: string, body: string, profileId: string | null): Promise<boolean> {
  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.chatConversation.findFirst({ where: { id: conversationId, clientId, status: "open" }, select: { id: true } });
    if (!conversation) return false;
    const message = await tx.chatMessage.create({
      data: { conversationId, clientId, sender: "staff", body, staffProfileId: profileId },
      select: { createdAt: true },
    });
    await tx.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt, unreadForStaff: 0 } });
    return true;
  });
}

export async function setConversationStatus(clientId: string, conversationId: string, status: "open" | "closed"): Promise<boolean> {
  const result = await requirePrisma().chatConversation.updateMany({ where: { id: conversationId, clientId }, data: { status } });
  return result.count === 1;
}

export async function setChatWidgetActive(clientId: string, widgetId: string, active: boolean): Promise<boolean> {
  const result = await requirePrisma().chatWidget.updateMany({ where: { id: widgetId, clientId }, data: { active } });
  return result.count === 1;
}

/** Creates a Lead in the existing Leads module from a conversation, once. */
export async function convertConversationToLead(clientId: string, conversationId: string): Promise<{ leadId: string } | null> {
  const prisma = requirePrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.findFirst({
        where: { id: conversationId, clientId },
        select: {
          id: true,
          leadId: true,
          visitorName: true,
          visitorEmail: true,
          visitorPhone: true,
          pageUrl: true,
          widget: { select: { businessBrandId: true, name: true } },
          messages: { where: { sender: "visitor" }, orderBy: { createdAt: "asc" }, take: 5, select: { body: true } },
        },
      });
      if (!conversation) return null;
      if (conversation.leadId) return { leadId: conversation.leadId };
      const lead = await tx.lead.create({
        data: {
          clientId,
          businessBrandId: conversation.widget.businessBrandId,
          name: conversation.visitorName,
          email: conversation.visitorEmail,
          phone: conversation.visitorPhone,
          message: conversation.messages.map((m) => m.body).join("\n\n").slice(0, 4000) || null,
          metadata: { source: "takatak_web_chat", conversationId: conversation.id, widget: conversation.widget.name, pageUrl: conversation.pageUrl },
        },
        select: { id: true },
      });
      const claimed = await tx.chatConversation.updateMany({ where: { id: conversation.id, leadId: null }, data: { leadId: lead.id } });
      if (claimed.count !== 1) throw new Error("lead_already_linked");
      return { leadId: lead.id };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "lead_already_linked") {
      const existing = await prisma.chatConversation.findFirst({ where: { id: conversationId, clientId }, select: { leadId: true } });
      return existing?.leadId ? { leadId: existing.leadId } : null;
    }
    throw error;
  }
}
