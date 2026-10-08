// Files a website visitor attaches to their request.
//
// The browser first creates the lead, then uploads each file with the
// short-lived upload token returned for that lead. The file type is decided
// from the file's own bytes (not the browser's claim) and must match its
// extension. Files go to a private bucket; nothing here makes them public.

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { Prisma } from "@prisma/client";

import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_LEAD,
  MAX_TOTAL_BYTES_PER_LEAD,
} from "./attachment-rules";

export { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_LEAD, MAX_TOTAL_BYTES_PER_LEAD };
export const UPLOAD_TOKEN_TTL_MS = 30 * 60 * 1000;

type AllowedType = { mime: string; extensions: string[]; sniff: (bytes: Uint8Array) => boolean };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const isZip = (bytes: Uint8Array) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);

const ALLOWED_TYPES: AllowedType[] = [
  { mime: "application/pdf", extensions: ["pdf"], sniff: (b) => startsWith(b, ascii("%PDF-")) },
  { mime: "image/png", extensions: ["png"], sniff: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: "image/jpeg", extensions: ["jpg", "jpeg"], sniff: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { mime: "image/webp", extensions: ["webp"], sniff: (b) => startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8) },
  { mime: "image/gif", extensions: ["gif"], sniff: (b) => startsWith(b, ascii("GIF87a")) || startsWith(b, ascii("GIF89a")) },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
    sniff: isZip,
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
    sniff: isZip,
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: ["pptx"],
    sniff: isZip,
  },
  {
    mime: "text/plain",
    extensions: ["txt"],
    // Plain text: no NUL bytes in the first 8 KB.
    sniff: (b) => !b.subarray(0, 8192).includes(0),
  },
];

/** Extensions the server accepts; must equal ACCEPTED_EXTENSIONS in attachment-rules.ts. */
export const SERVER_ACCEPTED_EXTENSIONS = ALLOWED_TYPES.flatMap((type) => type.extensions.map((ext) => `.${ext}`));

export type FileCheck =
  | { ok: true; mime: string; extension: string; safeName: string }
  | { ok: false; reason: "empty" | "too_large" | "unsupported_type" | "content_mismatch" };

/** Keeps a readable file name without paths, control or shell characters. */
export function safeFileName(name: string, extension: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/\.[^.]*$/, "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120);
  return `${base || "attachment"}.${extension}`;
}

export function checkAttachment(name: string, bytes: Uint8Array): FileCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_ATTACHMENT_BYTES) return { ok: false, reason: "too_large" };
  const extension = (name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "").toLowerCase();
  const type = ALLOWED_TYPES.find((candidate) => candidate.extensions.includes(extension));
  if (!type) return { ok: false, reason: "unsupported_type" };
  if (!type.sniff(bytes)) return { ok: false, reason: "content_mismatch" };
  return { ok: true, mime: type.mime, extension, safeName: safeFileName(name, extension) };
}

// ── Upload tokens ───────────────────────────────────────────────────────────

function sign(secret: string, leadId: string, clientId: string, expiresAt: number): string {
  return createHmac("sha256", secret).update(`${leadId}.${clientId}.${expiresAt}`).digest("base64url");
}

export function createUploadToken(input: { secret: string; leadId: string; clientId: string; now?: Date }): string {
  const expiresAt = Math.floor(((input.now ?? new Date()).getTime() + UPLOAD_TOKEN_TTL_MS) / 1000);
  return `${input.leadId}.${expiresAt}.${sign(input.secret, input.leadId, input.clientId, expiresAt)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Returns the lead id when the token is authentic, unexpired and for this workspace. */
export function verifyUploadToken(input: {
  secret: string;
  clientId: string;
  token: unknown;
  now?: Date;
}): string | null {
  if (typeof input.token !== "string" || input.token.length > 200) return null;
  const [leadId, expiresRaw, signature, extra] = input.token.split(".");
  if (extra !== undefined || !leadId || !expiresRaw || !signature) return null;
  if (!UUID_RE.test(leadId) || !/^\d{9,11}$/.test(expiresRaw)) return null;
  const expiresAt = Number(expiresRaw);
  if (expiresAt * 1000 < (input.now ?? new Date()).getTime()) return null;
  const expected = Buffer.from(sign(input.secret, leadId, input.clientId, expiresAt));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return leadId;
}

// ── Storage + database ──────────────────────────────────────────────────────

export interface AttachmentStorage {
  bucket: string;
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface AttachmentDb {
  lead: Pick<Prisma.TransactionClient["lead"], "findFirst">;
  leadAttachment: Pick<Prisma.TransactionClient["leadAttachment"], "aggregate" | "create">;
}

export type AttachmentRefusal =
  | Extract<FileCheck, { ok: false }>["reason"]
  | "lead_not_found"
  | "too_many_files"
  | "lead_quota_exceeded"
  | "storage_failed";

export type AttachmentResult =
  | { ok: true; id: string; name: string; sizeBytes: number }
  | { ok: false; reason: AttachmentRefusal };

export async function recordLeadAttachment(
  db: AttachmentDb,
  storage: AttachmentStorage,
  input: { clientId: string; leadId: string; fileName: string; bytes: Uint8Array; now?: Date },
): Promise<AttachmentResult> {
  const check = checkAttachment(input.fileName, input.bytes);
  if (!check.ok) return check;

  const lead = await db.lead.findFirst({
    where: { id: input.leadId, clientId: input.clientId },
    select: { id: true },
  });
  if (!lead) return { ok: false, reason: "lead_not_found" };

  const existing = await db.leadAttachment.aggregate({
    where: { leadId: input.leadId, status: { not: "deleted" } },
    _count: { _all: true },
    _sum: { sizeBytes: true },
  });
  if (existing._count._all >= MAX_ATTACHMENTS_PER_LEAD) return { ok: false, reason: "too_many_files" };
  if ((existing._sum.sizeBytes ?? 0) + input.bytes.length > MAX_TOTAL_BYTES_PER_LEAD) {
    return { ok: false, reason: "lead_quota_exceeded" };
  }

  const id = randomUUID();
  const now = input.now ?? new Date();
  const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const path = `website-leads/${input.clientId}/${month}/${input.leadId}/${id}.${check.extension}`;

  try {
    await storage.upload(path, input.bytes, check.mime);
  } catch {
    return { ok: false, reason: "storage_failed" };
  }

  try {
    await db.leadAttachment.create({
      data: {
        id,
        clientId: input.clientId,
        leadId: input.leadId,
        storageBucket: storage.bucket,
        storagePath: path,
        originalName: check.safeName,
        mimeType: check.mime,
        sizeBytes: input.bytes.length,
        status: "quarantined",
      },
    });
  } catch (error) {
    await storage.remove(path).catch(() => undefined);
    throw error;
  }

  return { ok: true, id, name: check.safeName, sizeBytes: input.bytes.length };
}
