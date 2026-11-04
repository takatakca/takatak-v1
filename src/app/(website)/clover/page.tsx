import type { Metadata } from "next";

import { CloverSuitePage } from "@/components/website/clover/CloverSuitePage";

export const metadata: Metadata = {
  title: "Suite Clover TAKATAK · Neuf applications pour votre caisse Clover",
  description:
    "C4ISSE, T4CTILE, 4CCOUNTING, TR4CKER, ST4FF, M4RKETING, LOY4LTY, REW4RDS et CH4T : caisse, borne, comptabilité, livraisons, équipe, marketing, fidélité, cartes-cadeaux et soutien, reliés par TAKATAK Food Hub.",
  alternates: { canonical: "/clover" },
};

export default function CloverPage() {
  return <CloverSuitePage />;
}
