import type { Metadata } from "next";

import { ContactContent } from "@/components/website/pages/contact-content";

export const metadata: Metadata = {
  title: "Nous joindre · Contact TAKATAK",
  description:
    "Écrivez à l'équipe TAKATAK : une question, un projet, une facture. Write to the TAKATAK team in English or French; a person answers.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { topic } = await searchParams;
  return <ContactContent initialTopic={typeof topic === "string" ? topic : null} />;
}
