"use server";

import { revalidatePath } from "next/cache";

import { publicAppOrigin } from "@/lib/growth/public-origin";
import { growthSmsConfigured, growthWhatsAppConfigured, sendGrowthSms, sendWhatsAppReviewTemplate } from "@/lib/messaging/delivery";
import { maskPhone, toE164 } from "@/lib/messaging/phone";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { Permission } from "@/lib/security/roles";
import {
  convertReviewResponseToLead,
  createReviewProfile,
  createReviewRequest,
  recordRequestDelivery,
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

export type RequestLinkState =
  | { ok: null }
  | { ok: true; url: string; recipientName: string | null; delivery: null | { sent: true; to: string } | { sent: false; reason: string } }
  | { ok: false; error: string };

export async function createReviewRequestAction(_prev: RequestLinkState, formData: FormData): Promise<RequestLinkState> {
  const access = await scopedAccess("manage_reputation");
  if (!access) return { ok: false, error: "You do not have permission to send review requests." };
  const profileId = String(formData.get("profileId") ?? "");
  if (!UUID.test(profileId)) return { ok: false, error: "Choose a review page." };
  const recipientRaw = String(formData.get("recipientName") ?? "").trim().replace(/\s+/g, " ");
  const recipientName = recipientRaw ? recipientRaw.slice(0, 40) : null;
  const channel = parseReviewChannel(formData.get("channel"));
  const sendNow = formData.get("sendNow") === "on" && (channel === "sms" || channel === "whatsapp");
  const phone = sendNow ? toE164(String(formData.get("phone") ?? "")) : null;
  if (sendNow && !phone) return { ok: false, error: "Enter the customer's mobile number (10 digits, or with country code)." };
  if (sendNow && channel === "sms" && !growthSmsConfigured()) return { ok: false, error: "Automatic SMS is not configured yet." };
  if (sendNow && channel === "whatsapp" && !growthWhatsAppConfigured()) return { ok: false, error: "Automatic WhatsApp is not configured yet." };
  try {
    const created = await createReviewRequest(access.activeClientId, profileId, { channel, recipientName }, access.profileId);
    if (!created) return { ok: false, error: "That review page is paused or not in this workspace." };
    const url = `${await publicAppOrigin()}/r/${created.publicSlug}?t=${created.token}`;
    let delivery: Extract<RequestLinkState, { ok: true }>["delivery"] = null;
    if (sendNow && phone) {
      const greeting = recipientName ? `Bonjour ${recipientName}` : "Bonjour";
      const result =
        channel === "sms"
          ? await sendGrowthSms(
              phone,
              `${greeting}, merci d'avoir choisi ${created.profileName}! Votre avis compte (30 s) : ${url}\nRépondez STOP pour ne plus recevoir de messages.`,
            )
          : await sendWhatsAppReviewTemplate(phone, { name: recipientName ?? "", business: created.profileName, link: url });
      await recordRequestDelivery(access.activeClientId, created.requestId, {
        status: result.ok ? "sent" : "failed",
        providerMessageId: result.ok ? result.providerMessageId : null,
        recipientMasked: maskPhone(phone),
      });
      delivery = result.ok ? { sent: true, to: maskPhone(phone) } : { sent: false, reason: result.reason };
    }
    revalidatePath(REVIEWS_PATH);
    return { ok: true, url, recipientName, delivery };
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

export async function convertReviewToLeadAction(formData: FormData): Promise<void> {
  const access = await scopedAccess("manage_reputation");
  const responseId = String(formData.get("responseId") ?? "");
  if (!access || !UUID.test(responseId)) return;
  await convertReviewResponseToLead(access.activeClientId, responseId);
  revalidatePath(REVIEWS_PATH);
}
