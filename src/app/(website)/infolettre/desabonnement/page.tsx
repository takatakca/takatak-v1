import type { Metadata } from "next";

import { NewsletterLink } from "@/components/website/funnel/NewsletterLink";
import { HomeThemeRoot } from "@/lib/website/home-theme";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="tk-page">
      <HomeThemeRoot>
        <NewsletterLink mode="unsubscribe" />
      </HomeThemeRoot>
    </div>
  );
}
