import type { Metadata } from "next";

import { FreeToolsBoard } from "@/components/website/seo/FreeToolsBoard";

export const metadata: Metadata = {
  title: "Outils SEO gratuits · Free SEO & AI Search Tools",
  description:
    "Outils SEO gratuits de TAKATAK : vérifications techniques, préparation à la recherche IA, données structurées et mots-clés. Free technical SEO scanners, AI discovery checks and structured data generators. A free TAKATAK account is required.",
  alternates: { canonical: "/free-tools" },
};

export default function PublicSeoToolsPage() {
  return <FreeToolsBoard />;
}
