// Claude (Anthropic) · 2026-11-21 — native app sign-in, step 0: tells the phone whether this email is the store
// reviewer's (then no email is sent and the reviewer types the code from the store console). Answers false for
// every other email and whenever reviewer access is off. See src/lib/mobile/review-access.ts.
import type { NextRequest } from "next/server";

import { authJson, readTrustedJsonBody, wrapAuthRoute } from "@/lib/auth/auth-json";
import { normalizeEmail } from "@/lib/auth/registration-validation";
import { isReviewEmail } from "@/lib/mobile/review-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function review(request: NextRequest) {
  const parsed = await readTrustedJsonBody(request, 1000);
  if (!parsed.ok) return parsed.response;
  const raw = (parsed.body as { email?: unknown } | null)?.email;
  const email = typeof raw === "string" ? normalizeEmail(raw) : "";
  return authJson({ ok: true, message: "OK", review: isReviewEmail(email) }, 200);
}

export const POST = wrapAuthRoute("mobile-review", "Sign-in is temporarily unavailable.", review);
