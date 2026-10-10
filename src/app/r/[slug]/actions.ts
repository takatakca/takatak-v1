"use server";

import { headers } from "next/headers";

import { allowPublicReviewSubmit, clientKeyFromHeaders } from "@/lib/reputation/rate-limit";
import { submitPublicRating } from "@/lib/reputation/service";
import { parsePublicRatingInput, PUBLIC_SLUG_PATTERN } from "@/lib/reputation/validation";

export type RatingFormState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | {
      status: "done";
      rating: number;
      responseId: string;
      hasGoogle: boolean;
      hasFacebook: boolean;
      thankYouMessage: string | null;
    };

export async function submitRatingAction(_prev: RatingFormState, formData: FormData): Promise<RatingFormState> {
  // Honeypot: real customers never see or fill this field.
  if (String(formData.get("website") ?? "").trim()) {
    return { status: "error", error: "Something went wrong. Please try again." };
  }

  const slug = String(formData.get("slug") ?? "");
  if (!PUBLIC_SLUG_PATTERN.test(slug)) return { status: "error", error: "This review page is no longer available." };

  if (!allowPublicReviewSubmit(clientKeyFromHeaders(await headers()))) {
    return { status: "error", error: "Too many submissions. Please wait a few minutes and try again." };
  }

  const parsed = parsePublicRatingInput(Object.fromEntries(formData.entries()));
  if (!parsed.ok) return { status: "error", error: parsed.error };

  const tokenRaw = String(formData.get("t") ?? "").trim();
  try {
    const result = await submitPublicRating(slug, tokenRaw || null, parsed.value);
    if (!result.ok) return { status: "error", error: result.error };
    return {
      status: "done",
      rating: parsed.value.rating,
      responseId: result.responseId,
      hasGoogle: result.hasGoogle,
      hasFacebook: result.hasFacebook,
      thankYouMessage: result.thankYouMessage,
    };
  } catch {
    console.error("[reputation] public rating submit failed");
    return { status: "error", error: "We could not save your rating. Please try again in a moment." };
  }
}
