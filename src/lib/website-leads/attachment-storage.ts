import "server-only";

// Supabase Storage (private bucket) for website lead attachments.

import { createClient } from "@supabase/supabase-js";

import type { AttachmentStorage } from "./attachments";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url.startsWith("https://") || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function leadAttachmentStorage(bucket: string): AttachmentStorage | null {
  const client = adminClient();
  if (!client) return null;
  return {
    bucket,
    async upload(path, bytes, contentType) {
      const result = await client.storage
        .from(bucket)
        .upload(path, bytes, { contentType, cacheControl: "0", upsert: false });
      if (result.error) throw new Error("lead_attachment_upload_failed");
    },
    async remove(path) {
      await client.storage.from(bucket).remove([path]);
    },
  };
}

/** One-minute download link that saves the file under its original name. */
export async function signedAttachmentDownload(
  attachment: { storageBucket: string; storagePath: string; originalName: string },
): Promise<string | null> {
  const client = adminClient();
  if (!client) return null;
  const result = await client.storage
    .from(attachment.storageBucket)
    .createSignedUrl(attachment.storagePath, 60, { download: attachment.originalName });
  return result.data?.signedUrl ?? null;
}
