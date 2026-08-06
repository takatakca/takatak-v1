import type { Metadata } from "next";

import { PostProjectForm } from "@/components/website/marketplace/post-project-form";
import { getWebsiteSession } from "@/lib/website/website-session";

export const metadata: Metadata = {
  title:
    "Post a project — TAKATAK Marketplace",
};

export default async function PostProjectPage() {
  const session =
    await getWebsiteSession();

  return (
    <PostProjectForm
      isAuthenticated={
        session.isAuthenticated
      }
    />
  );
}