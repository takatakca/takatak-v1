import type { Metadata } from "next";

import { TakbotStudio } from "@/components/website/takbot/TakbotStudio";
import { takbotCopy } from "@/lib/takbot/copy";

export const metadata: Metadata = {
  title: takbotCopy.meta.title,
  description: takbotCopy.meta.description,
  alternates: { canonical: "/takbot" },
};

// TAK bot: the master AI bot. The page reads /api/takbot/catalog for live
// engine status and the visitor's credits, and runs prompts through /api/takbot/run.
export default function TakbotPage() {
  return <TakbotStudio />;
}
