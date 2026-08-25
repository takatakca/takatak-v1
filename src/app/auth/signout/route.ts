// Signs the current user out and returns to the login page.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { originFromRequest } from "@/lib/config/app-origin";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(
    new URL("/login", originFromRequest(request)),
    { status: 303 },
  );
}
