"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { Permission } from "@/lib/security/roles";
import {
  createReviewProfile,
  createReviewRequest,
  setReviewProfileActive,
  updateFeedbackStatus,
} from "@/lib/reputation/service";
import { parseFeedbackStatus, parseReviewChannel, parseReviewProfileInput } from "@/lib/reputation/validation";

const REVIEWS_PATH = "/dashboard/growth/reviews";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function scopedAccess(permission: Permission) {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, permission)) return null;
  return access;
}

async function publicBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\//.test(configured)) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type ProfileFormState = { ok: null } | { ok: true; message: string } | { ok: false; error: string };

export async function createReviewProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const access = await scopedAccess("manage_reputation");
  if (!access) return { ok: false, error: "You do not have permission to manage reputation for this workspace." };
  const parsed = parseReviewProfileInput(Object.fromEntries(formData.entries()));
  if (!parsed.ok) return parsed;
  try {
    await createReviewProfile(access.activeClientId, parsed.value);
  } catch (error) {
    if (error instanceof Error && error.message === "brand_not_in_workspace") return { ok: false, error: "That brand is not in this workspace." };
    console.error("[reputation] create profile failed");
    return { ok: false, error: "The review page could not be created. Try again." };
  }
  revalidatePath(REVIEWS_PATH);
  return { ok: true, message: "Review page created." };
}

export type RequestLinkState = { ok: null } | { ok: true; url: string; recipientName: string | null } | { ok: false; error: string };

export async function createReviewRequestAction(_prev: RequestLinkState, formData: FormData): Promise<RequestLinkState> {
  const access = await scopedAccess("manage_reputation");
  if (!access) return { ok: false, error: "You do not have permission to send review requests." };
  const profileId = String(formData.get("profileId") ?? "");
  if (!UUID.test(profileId)) return { ok: false, error: "Choose a review page." };
  const recipientRaw = String(formData.get("recipientName") ?? "").trim().replace(/\s+/g, " ");
  const recipientName = recipientRaw ? recipientRaw.slice(0, 40) : null;
  try {
    const created = await createReviewRequest(
      access.activeClientId,
      profileId,
      { channel: parseReviewChannel(formData.get("channel")), recipientName },
      access.profileId,
    );
    if (!created) return { ok: false, error: "That review page is paused or not in this workspace." };
    const url = `${await publicBaseUrl()}/r/${created.publicSlug}?t=${created.token}`;
    revalidatePath(REVIEWS_PATH);
    return { ok: true, url, recipientName };
  } catch {
    console.error("[reputation] create request failed");
    return { ok: false, error: "The request link could not be created. Try again." };
  }
}

export async function updateFeedbackStatusAction(formData: FormData): Promise<void> {
  const access = await scopedAccess("manage_reputation");
  if (!access) return;
  const responseId = String(formData.get("responseId") ?? "");
  const status = parseFeedbackStatus(formData.get("status"));
  if (!UUID.test(responseId) || !status) return;
  await updateFeedbackStatus(access.activeClientId, responseId, status, access.profileId);
  revalidatePath(REVIEWS_PATH);
}

export async function toggleReviewProfileAction(formData: FormData): Promise<void> {
  const access = await scopedAccess("manage_reputation");
  if (!access) return;
  const profileId = String(formData.get("profileId") ?? "");
  if (!UUID.test(profileId)) return;
  await setReviewProfileActive(access.activeClientId, profileId, formData.get("active") === "true");
  revalidatePath(REVIEWS_PATH);
}
