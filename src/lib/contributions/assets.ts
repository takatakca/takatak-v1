import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { ahmvContributionScope } from "./scope";
import { AHMV_PUBLISHER } from "./publishers";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif","application/pdf"]);

function storageConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const bucket = process.env.TAKATAK_CONTRIBUTION_UPLOAD_BUCKET?.trim() || "community-contribution-quarantine";
  if (!url.startsWith("https://") || !key || !bucket) throw new Error("CONTRIBUTION_STORAGE_NOT_CONFIGURED");
  return { url, key, bucket };
}
function admin() {
  const cfg = storageConfig();
  return { cfg, client: createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
function ext(type: string) {
  return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/heic" ? "heic" : type === "image/heif" ? "heif" : type === "application/pdf" ? "pdf" : "bin";
}
function publicAssetUrl(id: string) {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://takatak.ca");
  if (origin.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("PUBLIC_APP_ORIGIN_NOT_HTTPS");
  return new URL(`/api/public/content-assets/${id}`, origin).toString();
}

export async function uploadAhmvContributionAsset(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("UNSUPPORTED_ASSET_TYPE");
  if (file.size <= 0 || file.size > MAX_BYTES) throw new Error("ASSET_SIZE_INVALID");
  const { prisma, brand } = await ahmvContributionScope();
  const { client, cfg } = admin();
  const id = randomUUID();
  const now = new Date();
  const path = `${AHMV_PUBLISHER.code}/${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,"0")}/${id}.${ext(file.type)}`;
  const uploaded = await client.storage.from(cfg.bucket).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploaded.error) throw new Error("ASSET_UPLOAD_FAILED");
  try {
    const asset = await prisma.contributionAsset.create({
      data: { id, clientId: brand.clientId, businessBrandId: brand.id, publisherCode: AHMV_PUBLISHER.code, storageBucket: cfg.bucket, storagePath: path, originalName: file.name.slice(0,240) || `upload.${ext(file.type)}`, mimeType: file.type, sizeBytes: file.size, status: "quarantined", expiresAt: new Date(now.getTime()+30*24*60*60*1000) },
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true, status: true },
    });
    const preview = await client.storage.from(cfg.bucket).createSignedUrl(path, 3600);
    return { ...asset, previewUrl: preview.data?.signedUrl ?? null };
  } catch (error) {
    await client.storage.from(cfg.bucket).remove([path]).catch(() => undefined);
    throw error;
  }
}

export async function signedAssetPreviewUrl(asset: { storageBucket: string; storagePath: string }) {
  const { client } = admin();
  const result = await client.storage.from(asset.storageBucket).createSignedUrl(asset.storagePath, 3600);
  return result.data?.signedUrl ?? null;
}

export async function resolveAssetTokens(value: unknown, assets: readonly { id: string }[]): Promise<unknown> {
  const allowed = new Set(assets.map((asset) => asset.id));
  const walk = async (current: unknown): Promise<unknown> => {
    if (typeof current === "string" && current.startsWith("takatak-asset:")) {
      const id = current.slice("takatak-asset:".length);
      if (!allowed.has(id)) throw new Error("UNATTACHED_ASSET_REFERENCE");
      return publicAssetUrl(id);
    }
    if (Array.isArray(current)) return Promise.all(current.map(walk));
    if (current && typeof current === "object") {
      const out: Record<string, unknown> = {};
      for (const [key,item] of Object.entries(current as Record<string,unknown>)) out[key] = await walk(item);
      return out;
    }
    return current;
  };
  return walk(value);
}

export async function publicApprovedAssetRedirect(assetId: string) {
  const { prisma } = await ahmvContributionScope();
  const asset = await prisma.contributionAsset.findFirst({
    where: { id: assetId, publisherCode: AHMV_PUBLISHER.code, status: { in: ["approved","published"] } },
    select: { storageBucket: true, storagePath: true, mimeType: true },
  });
  if (!asset) return null;
  const { client } = admin();
  const signed = await client.storage.from(asset.storageBucket).createSignedUrl(asset.storagePath, 300);
  return signed.data?.signedUrl ? { url: signed.data.signedUrl, mimeType: asset.mimeType } : null;
}
