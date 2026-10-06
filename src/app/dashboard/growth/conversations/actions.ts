"use server";

import { revalidatePath } from "next/cache";

import {
  cleanMessage,
  convertConversationToLead,
  createChatWidget,
  setChatWidgetActive,
  setConversationStatus,
  staffReply,
} from "@/lib/chat/service";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

const BASE = "/dashboard/growth/conversations";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canManage() {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, "manage_conversations")) return null;
  return access;
}

export type WidgetFormState = { ok: null } | { ok: true; message: string } | { ok: false; error: string };

export async function createChatWidgetAction(_prev: WidgetFormState, formData: FormData): Promise<WidgetFormState> {
  const access = await canManage();
  if (!access) return { ok: false, error: "You do not have permission to manage chat for this workspace." };
  try {
    const result = await createChatWidget(access.activeClientId, {
      name: formData.get("name"),
      domain: formData.get("domain"),
      greeting: formData.get("greeting"),
      accentColor: formData.get("accentColor"),
      whatsappNumber: formData.get("whatsappNumber"),
      businessBrandId: formData.get("businessBrandId"),
    });
    if ("error" in result) return { ok: false, error: result.error };
  } catch {
    console.error("[chat] create widget failed");
    return { ok: false, error: "The chat could not be created. Try again." };
  }
  revalidatePath(BASE);
  return { ok: true, message: "Chat created. Copy the install code below." };
}

export async function toggleChatWidgetAction(formData: FormData): Promise<void> {
  const access = await canManage();
  const id = String(formData.get("widgetId") ?? "");
  if (!access || !UUID.test(id)) return;
  await setChatWidgetActive(access.activeClientId, id, formData.get("active") === "true");
  revalidatePath(BASE);
}

export type ReplyState = { ok: null } | { ok: true; at: number } | { ok: false; error: string };

export async function replyAction(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const access = await canManage();
  if (!access) return { ok: false, error: "You do not have permission to reply." };
  const id = String(formData.get("conversationId") ?? "");
  const body = cleanMessage(formData.get("body"));
  if (!UUID.test(id) || !body) return { ok: false, error: "Write a message first." };
  try {
    const sent = await staffReply(access.activeClientId, id, body, access.profileId);
    if (!sent) return { ok: false, error: "This conversation is closed. Reopen it to reply." };
  } catch {
    console.error("[chat] reply failed");
    return { ok: false, error: "The reply could not be sent. Try again." };
  }
  revalidatePath(`${BASE}/${id}`);
  return { ok: true, at: Date.now() };
}

export async function setConversationStatusAction(formData: FormData): Promise<void> {
  const access = await canManage();
  const id = String(formData.get("conversationId") ?? "");
  const status = formData.get("status") === "closed" ? "closed" : "open";
  if (!access || !UUID.test(id)) return;
  await setConversationStatus(access.activeClientId, id, status);
  revalidatePath(`${BASE}/${id}`);
  revalidatePath(BASE);
}

export async function convertToLeadAction(formData: FormData): Promise<void> {
  const access = await canManage();
  const id = String(formData.get("conversationId") ?? "");
  if (!access || !UUID.test(id)) return;
  await convertConversationToLead(access.activeClientId, id);
  revalidatePath(`${BASE}/${id}`);
}
