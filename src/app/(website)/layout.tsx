import type {
    Metadata,
    Viewport,
  } from "next";
  import {
    Inter,
    Space_Grotesk,
  } from "next/font/google";
  import type { ReactNode } from "react";
  
  import { SiteShell } from "@/components/website/layout/site-shell";
  import { PromoStickyCard } from "@/components/website/promotions/promo-sticky-card";
  import { PromoTopBar } from "@/components/website/promotions/promo-top-bar";
  import { SignupPromoModal } from "@/components/website/promotions/signup-promo-modal";
  import { getWebsiteSession } from "@/lib/website/website-session";
  
  import "./website.css";
  
  const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable:
      "--font-website-body",
  });
  
  const spaceGrotesk =
    Space_Grotesk({
      subsets: ["latin"],
      display: "swap",
      variable:
        "--font-website-display",
    });
  
  export const metadata: Metadata = {
    title: {
      default:
        "TAKATAK — Automated online business services",
  
      template: "%s — TAKATAK",
    },
  
    description:
      "Launch, host, market, and automate your business with TAKATAK. Domains, hosting, websites, marketing, social media, VoIP, and AI-assisted business tools.",
  
    applicationName: "TAKATAK",
  
    authors: [
      {
        name: "TAKATAK",
      },
    ],
  
    creator: "TAKATAK",
    publisher: "TAKATAK",
  
    metadataBase: new URL(
      process.env
        .NEXT_PUBLIC_APP_URL ??
        "https://takatak.ca",
    ),
  
    openGraph: {
      type: "website",
      siteName: "TAKATAK",
      title:
        "TAKATAK — Automated online business services",
      description:
        "Managed online services for growing businesses.",
    },
  
    twitter: {
      card: "summary_large_image",
      title:
        "TAKATAK — Automated online business services",
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
    const session =
      await getWebsiteSession();
  
    return (
      <div
        className={`website-surface ${inter.variable} ${spaceGrotesk.variable}`}
      >
        <PromoTopBar />
  
        <SiteShell
          isAuthenticated={
            session.isAuthenticated
          }
        >
          {children}
        </SiteShell>
  
        <PromoStickyCard />
  
        <SignupPromoModal />
      </div>
    );
  }