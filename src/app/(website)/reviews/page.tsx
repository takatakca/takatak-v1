import type { Metadata } from "next";
import { ReviewProductPage } from "@/components/reputation/website/review-product-page";

export const metadata: Metadata = {
  title: "TAKATAK Review — Reviews, customer feedback & reputation",
  description:
    "Bring customer feedback into your TAKATAK workspace. Manage reviews, review requests, authorized imports and AI-assisted replies across your business locations.",
  alternates: { canonical: "https://review.takatak.ca/" },
};

export default function ReviewsProductPage() {
  return <ReviewProductPage />;
}
