import type {
  Metadata,
  Viewport,
} from "next";
import type { ReactNode } from "react";
import {
  Inter,
  Space_Grotesk,
} from "next/font/google";

import { SiteShell } from "@/components/website/layout/SiteShell";
import { PromoTopBar } from "@/components/website/promotions/PromoTopBar";
import { AnimatedPromoInvite } from "@/components/website/promotions/AnimatedPromoInvite";
import { SignupPromoModal } from "@/components/website/promotions/SignupPromoModal";
import { LiveChatLauncher } from "@/components/website/support/LiveChatLauncher";
import { getWebsiteSession } from "@/lib/website/website-session";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { WebsiteProviders } from "@/lib/website/website-providers";
import { UpmindHeadScripts } from "@/components/website/domain/upmind-head-scripts";

import "./website.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-website-body",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-website-display",
});

export const metadata: Metadata = {
  title: {
    default:
      "TAKATAK — Business services marketplace: websites, domains, hosting & growth",
    template: "%s — TAKATAK",
  },
  description:
    "Find the right service, launch your digital foundation, and connect websites, hosting, marketing, leads, communications and automation in one professional experience.",
  applicationName: "TAKATAK",
  authors: [{ name: "TAKATAK" }],
  creator: "TAKATAK",
  publisher: "TAKATAK",
  metadataBase: new URL(getApplicationOrigin()),
  openGraph: {
    type: "website",
    siteName: "TAKATAK",
    title: "TAKATAK — Business services marketplace",
    description:
      "Managed online services for growing businesses.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TAKATAK — Business services marketplace",
    description:
      "TAKATAK automates business services, from domains and hosting to AI-driven marketing and a freelancer marketplace.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function WebsiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getWebsiteSession();

  return (
    <div
      className={`website-surface ${inter.variable} ${spaceGrotesk.variable}`}
    >
      <UpmindHeadScripts />
      <WebsiteProviders
        isAuthenticated={session.isAuthenticated}
        email={session.email}
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
