import type { Metadata } from "next";

import { AboutContent } from "@/components/website/pages/about-content";

export const metadata: Metadata = {
  title: "À propos de TAKATAK · About GROUPE TAKATAK",
  description:
    "GROUPE TAKATAK, Montréal : sites web, hébergement, marketing, automatisation, IA et outils pour restaurants. Websites, hosting, marketing, automation, AI and restaurant tools.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <AboutContent />;
}
