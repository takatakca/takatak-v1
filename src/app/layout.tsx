import { NetworkStatusBanner } from "@/components/network/network-status-banner";
import { ClickPendingProvider } from "@/components/ui/click-pending-provider";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { HOME_LANGUAGE_HEADER, homeLanguage } from "@/lib/website/home-seo";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Not preloaded: the public website uses its own fonts, so preloading these on
// every page only delays the first paint on phones. The dashboard still gets them.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Takatak Official website",
  description: "takatak.ca official platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = homeLanguage((await headers()).get(HOME_LANGUAGE_HEADER));
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NetworkStatusBanner />
        <ClickPendingProvider>{children}</ClickPendingProvider>
      </body>
    </html>
  );
}
