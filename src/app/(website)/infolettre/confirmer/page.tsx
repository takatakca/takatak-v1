import type { Metadata } from "next";

import { NewsletterLink } from "@/components/website/funnel/NewsletterLink";
import { HomeThemeRoot } from "@/lib/website/home-theme";

export const metadata: Metadata = {
  title: "Confirm newsletter",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="tk-page">
      <HomeThemeRoot>
        <NewsletterLink mode="confirm" />
      </HomeThemeRoot>
    </div>
  );
}
