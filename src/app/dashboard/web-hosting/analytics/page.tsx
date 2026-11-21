import { redirect } from "next/navigation";

// Website analytics live in Growth › Analytics (TAKATAK's own first-party
// measurement plus Google Analytics 4 when connected). One screen, not two.
export default function WebsiteAnalyticsPage() {
  redirect("/dashboard/growth/analytics");
}
