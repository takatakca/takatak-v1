import "server-only";

import {
    createClient,
    type SupabaseClient,
  } from "@supabase/supabase-js";
  
  type SupabaseAdminEnvironment = {
    url: string;
    secretKey: string;
  };
  
  const globalForSupabaseAdmin = globalThis as unknown as {
    supabaseAdmin?: SupabaseClient;
  };
  
  function getSupabaseAdminEnvironment(): SupabaseAdminEnvironment | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const secretKey =
      process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  
    if (!url || !secretKey) {
      return null;
    }
  
    try {
      const parsedUrl = new URL(url);
  
      const loopback =
        parsedUrl.hostname === "localhost" ||
        parsedUrl.hostname === "127.0.0.1" ||
        parsedUrl.hostname === "::1";
      if (parsedUrl.protocol !== "https:" && !loopback) {
        return null;
      }
    } catch {
      return null;
    }
  
    return {
      url,
      secretKey,
    };
  }
  
  export function isSupabaseAdminConfigured(): boolean {
    return getSupabaseAdminEnvironment() !== null;
  }
  
  export function getSupabaseAdminClient(): SupabaseClient | null {
    const environment = getSupabaseAdminEnvironment();
  
    if (!environment) {
      return null;
    }
  
    if (!globalForSupabaseAdmin.supabaseAdmin) {
      globalForSupabaseAdmin.supabaseAdmin = createClient(
        environment.url,
        environment.secretKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        },
      );
    }
  
    return globalForSupabaseAdmin.supabaseAdmin;
  }