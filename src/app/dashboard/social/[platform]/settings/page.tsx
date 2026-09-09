import { notFound } from "next/navigation";

import BrandSettingsPage from "../../brands/settings/page";

export const dynamic = "force-dynamic";

/**
 * Fallback when `/dashboard/social/brands/settings` is matched as
 * `[platform]=brands` + `settings` instead of the static brands folder.
 */
export default async function NestedSocialSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { platform } = await params;
  if (platform !== "brands") {
    notFound();
  }

  return <BrandSettingsPage searchParams={searchParams} />;
}
