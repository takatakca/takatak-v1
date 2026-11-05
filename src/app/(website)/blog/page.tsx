import type { Metadata } from "next";

import { BlogIntro } from "@/components/website/blog/BlogIntro";

export const metadata: Metadata = {
  title: "Blogue · Blog",
  description:
    "Le blogue TAKATAK, et une page de blogue pour chaque site web que vous branchez. The TAKATAK blog, and a blog page for every website you connect.",
  alternates: { canonical: "/blog" },
};

export default function TakatakBlogPage() {
  return <BlogIntro />;
}
