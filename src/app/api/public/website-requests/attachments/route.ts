import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse } from "@/lib/security/api-response";
import { redactSecrets } from "@/lib/security/redact";
import { hasValidWriteOrigin } from "@/lib/security/write-request";
import { leadAttachmentStorage } from "@/lib/website-leads/attachment-storage";
import {
  MAX_ATTACHMENT_BYTES,
  recordLeadAttachment,
  verifyUploadToken,
  type AttachmentRefusal,
} from "@/lib/website-leads/attachments";
import { readWebsiteLeadsConfig } from "@/lib/website-leads/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Multipart overhead allowed on top of the largest accepted file. */
const MAX_REQUEST_BYTES = MAX_ATTACHMENT_BYTES + 64 * 1024;

const REFUSAL_STATUS: Record<AttachmentRefusal, number> = {
  empty: 400,
  too_large: 413,
  unsupported_type: 415,
  content_mismatch: 415,
  lead_not_found: 403,
  too_many_files: 409,
  lead_quota_exceeded: 413,
  storage_failed: 503,
};

/** Attaches one file to a website lead, using the upload token from that lead's response. */
export async function POST(request: NextRequest) {
  const config = readWebsiteLeadsConfig();
  if (!config.enabled || !config.uploads) return jsonResponse({ ok: false, code: "not_enabled" }, 503);

  if (!hasValidWriteOrigin(request)) return jsonResponse({ ok: false, code: "forbidden" }, 403);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return jsonResponse({ ok: false, code: "unsupported_media_type" }, 415);
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_REQUEST_BYTES) {
    return jsonResponse({ ok: false, code: "too_large" }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ ok: false, code: "invalid_request" }, 400);
  }

  const leadId = verifyUploadToken({
    secret: config.uploads.secret,
    clientId: config.clientId,
    token: form.get("token"),
  });
  if (!leadId) return jsonResponse({ ok: false, code: "invalid_token" }, 403);

  const file = form.get("file");
  if (!(file instanceof File)) return jsonResponse({ ok: false, code: "file_required" }, 400);
  if (file.size > MAX_ATTACHMENT_BYTES) return jsonResponse({ ok: false, code: "too_large" }, 413);

  const prisma = getPrisma();
  const storage = leadAttachmentStorage(config.uploads.bucket);
  if (!prisma || !storage) return jsonResponse({ ok: false, code: "unavailable" }, 503);

  try {
    const result = await recordLeadAttachment(prisma, storage, {
      clientId: config.clientId,
      leadId,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    if (!result.ok) return jsonResponse({ ok: false, code: result.reason }, REFUSAL_STATUS[result.reason]);
    return jsonResponse({ ok: true, name: result.name, sizeBytes: result.sizeBytes }, 200);
  } catch (error) {
    console.error(
      "[website-attachments] upload failed:",
      redactSecrets(error instanceof Error ? error.message : "unknown_error"),
    );
    return jsonResponse({ ok: false, code: "unavailable" }, 503);
  }
}
