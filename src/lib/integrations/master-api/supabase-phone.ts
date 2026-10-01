import "server-only";

import { createClient, type User } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/auth/env";
import { MasterApiInputError, MasterApiUnavailableError } from "./errors";

type MasterPhoneMetadata = {
  email: string;
  fullName?: string | null;
  preferredLanguage?: string | null;
};

function client() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new MasterApiUnavailableError(
      "TAKATAK Supabase Phone Auth is not configured.",
    );
  }

  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function splitName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

export async function sendTakatakPhoneOtp(
  phone: string,
  metadata: MasterPhoneMetadata,
): Promise<void> {
  const supabase = client();
  const name = splitName(metadata.fullName);

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
      data: {
        email: metadata.email,
        phone,
        full_name: metadata.fullName?.trim() || null,
        display_name: metadata.fullName?.trim() || null,
        first_name: name.firstName,
        last_name: name.lastName,
        locale: metadata.preferredLanguage?.trim().slice(0, 16) || null,
        source_application: "1LV",
      },
    },
  });

  if (error) {
    throw new MasterApiUnavailableError(
      "TAKATAK phone verification could not be started.",
    );
  }
}

export async function verifyTakatakPhoneOtp(
  phone: string,
  code: string,
): Promise<User> {
  const supabase = client();

  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  });

  if (error || !data.user) {
    throw new MasterApiInputError(
      "Invalid or expired TAKATAK verification code.",
    );
  }

  return data.user;
}
