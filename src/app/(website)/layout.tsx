import type {
  Metadata,
  Viewport,
} from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { HOME_LANGUAGE_HEADER, HOME_SEO } from "@/lib/website/home-seo";
import localFont from "next/font/local";

import { SiteShell } from "@/components/website/layout/SiteShell";
import { PromoTopBar } from "@/components/website/promotions/PromoTopBar";
import { AnimatedPromoInvite } from "@/components/website/promotions/AnimatedPromoInvite";
import { SignupPromoModal } from "@/components/website/promotions/SignupPromoModal";
import { LiveChatLauncher } from "@/components/website/support/LiveChatLauncher";
import { getWebsiteSession } from "@/lib/website/website-session";
import { loadPublicCatalogRows } from "@/lib/website/load-public-catalog";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { WebsiteProviders } from "@/lib/website/website-providers";

import "./website.css";

const inter = localFont({
  src: "../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-website-body",
});

// Headings: Montserrat, the closest free match to the brand wordmark (BRAND.md).
const montserrat = localFont({
  src: "../../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-website-display",
});

export const metadata: Metadata = {
  title: {
    default: "TAKATAK — Websites, Hosting & Digital Marketing in Montréal",
    template: "%s — TAKATAK",
  },
  description: HOME_SEO.en.description,
  applicationName: "TAKATAK",
  authors: [{ name: "TAKATAK" }],
  creator: "TAKATAK",
  publisher: "TAKATAK",

  other: {
    "takatak-site-verification": "Uiqdl66eHgBENWGITqm8nInBumnb1n2b"
  },

  metadataBase: new URL(getApplicationOrigin()),
  openGraph: {
    type: "website",
    siteName: "TAKATAK",
    title: HOME_SEO.en.title,
    description: HOME_SEO.en.description,
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_SEO.en.title,
    description: HOME_SEO.en.description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060D1F",
};

export default async function WebsiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getWebsiteSession();
  const catalogRows = await loadPublicCatalogRows();
  const homeLocale = (await headers()).get(HOME_LANGUAGE_HEADER);

  return (
    <div
      className={`website-surface ${inter.variable} ${montserrat.variable}`}
    >
      <WebsiteProviders
        initialLanguage={homeLocale === "fr" ? "fr" : homeLocale === "en" ? "en" : undefined}
        isAuthenticated={session.isAuthenticated}
        email={session.email}
        catalogRows={catalogRows}
      >
        <PromoTopBar />
        <SiteShell>{children}</SiteShell>
        <AnimatedPromoInvite />
        <SignupPromoModal />
        <LiveChatLauncher />
      </WebsiteProviders>
    </div>
  );
}
