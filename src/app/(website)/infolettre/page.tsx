import type { Metadata } from "next";

import { NewsletterSignup } from "@/components/website/funnel/NewsletterSignup";
import { HomeThemeRoot } from "@/lib/website/home-theme";

export const metadata: Metadata = {
  title: "Infolettre · Newsletter",
  description:
    "L'infolettre de Groupe TAKATAK : les vraies offres en premier, les leçons de la TAKATAK Academy et nos nouveaux services. Désabonnement en un clic.",
  alternates: { canonical: "/infolettre" },
};

// Shareable sign-up page (links from social posts, videos and email signatures).
export default function NewsletterPage() {
  return (
    <div className="tk-page">
      <HomeThemeRoot>
        <NewsletterSignup sourcePage="/infolettre" titleAs="h1" />
      </HomeThemeRoot>
    </div>
  );
}
