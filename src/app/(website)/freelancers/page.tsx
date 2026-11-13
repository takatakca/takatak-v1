import type { Metadata } from "next";

import { FreelancersContent } from "@/components/website/pages/freelancers-content";

export const metadata: Metadata = {
  title: "Devenir pigiste · Become a TAKATAK freelancer",
  description:
    "Joignez l'équipe de pigistes de GROUPE TAKATAK : design, développement, rédaction, marketing, IA. Join the GROUPE TAKATAK freelancer roster and work on real client briefs.",
  alternates: { canonical: "/freelancers" },
};

export default function FreelancersPage() {
  return <FreelancersContent />;
}
