import "server-only";

import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { sendModeratorEmail } from "@/lib/contributions/moderator-email";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";

import { deviceLabel, ipHint } from "./device";

/** Opaque random id of this browser (httpOnly). Not a fingerprint, not a secret. */
export const DEVICE_COOKIE = "tk_device";
const DEVICE_ID = /^[A-Za-z0-9_-]{32}$/;
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export function readDeviceId(request: NextRequest): string | null {
  const value = request.cookies.get(DEVICE_COOKIE)?.value ?? "";
  return DEVICE_ID.test(value) ? value : null;
}

export function newDeviceId(): string {
  return randomBytes(24).toString("base64url");
}

export function writeDeviceCookie(response: NextResponse, deviceId: string): void {
  response.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
}

export function describeRequest(request: NextRequest): { label: string; ipHint: string | null } {
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
  return { label: deviceLabel(request.headers.get("user-agent")), ipHint: ipHint(ip) };
}

/** The signed-in person behind this request, or null. */
export async function currentProfile(): Promise<{ profileId: string; email: string | null } | null> {
  try {
    const { access, displayEmail } = await getServerAccessContext();
    if (!("profileId" in access) || typeof access.profileId !== "string") return null;
    return { profileId: access.profileId, email: displayEmail };
  } catch {
    return null;
  }
}

export function securityDb() {
  return getPrisma();
}

const montreal = (date: Date, lang: "fr" | "en") =>
  date.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Montreal" });

/**
 * The Uber-style alert (docs/CLIENT-WEBSITE-SECURITY-STANDARDS.md, measure 2):
 * date and time, account, device. No link in the email: the person is asked
 * to open TAKATAK themselves, so the message cannot be copied by a phisher.
 */
export async function sendNewSignInEmail(input: { to: string; device: string; ipHint: string | null; when: Date }): Promise<void> {
  const where = input.ipHint ? ` (réseau ${input.ipHint})` : "";
  const whereEn = input.ipHint ? ` (network ${input.ipHint})` : "";
  const text = [
    "Bonjour,",
    "",
    "Une nouvelle connexion à votre compte TAKATAK vient d'avoir lieu.",
    `• Date et heure : ${montreal(input.when, "fr")} (heure de Montréal)`,
    `• Compte : ${input.to}`,
    `• Appareil : ${input.device}${where}`,
    "",
    "Si c'était vous, il n'y a rien à faire.",
    "Si ce n'était pas vous : ouvrez TAKATAK vous-même sur un appareil où vous êtes déjà connecté et touchez « Ce n'était pas moi » dans la fenêtre de sécurité. Les autres sessions seront fermées. Vous pouvez aussi écrire à support@takatak.ca.",
    "",
    "TAKATAK ne vous demandera jamais votre code de connexion, ni par téléphone, ni par courriel, ni par texto.",
    "",
    "— L'équipe TAKATAK",
    "",
    "---",
    "",
    "Hello,",
    "",
    "Someone just signed in to your TAKATAK account.",
    `• Date and time: ${montreal(input.when, "en")} (Montréal time)`,
    `• Account: ${input.to}`,
    `• Device: ${input.device}${whereEn}`,
    "",
    "If it was you, there is nothing to do.",
    "If it was not you: open TAKATAK yourself on a device where you are already signed in and tap “It wasn't me” in the security window. Your other sessions will be closed. You can also write to support@takatak.ca.",
    "",
    "TAKATAK will never ask for your sign-in code, by phone, email or text message.",
    "",
    "— The TAKATAK team",
  ].join("\n");
  const result = await sendModeratorEmail({
    to: input.to,
    subject: "Nouvelle connexion à votre compte TAKATAK · New sign-in to your TAKATAK account",
    text,
    fromName: "TAKATAK Sécurité",
  });
  if (result !== "sent") console.warn("[security] new sign-in email not sent:", result);
}

/**
 * « Ce n'était pas moi »: revoke every other session of this person (Supabase
 * signOut scope "others", run with the trusted device's own session). Access
 * tokens already issued stay valid until they expire (Supabase default: 1 h).
 */
export async function signOutOtherSessions(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return false;
    const { error } = await supabase.auth.signOut({ scope: "others" });
    return !error;
  } catch {
    return false;
  }
}
