// Signs the current user out and returns to the login page.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(
    new URL("/login", request.url),
    { status: 303 },
  );
}