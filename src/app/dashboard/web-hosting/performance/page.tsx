import { redirect } from "next/navigation";

// Website speed is measured on the SEO screen (Google PageSpeed Insights:
// Core Web Vitals, mobile and desktop). One screen, not two.
export default function WebsitePerformancePage() {
  redirect("/dashboard/seo");
}
