/**
 * Maps a marketplace category slug to a realistic ServiceThumbnail kind.
 * Used by listing cards and gig detail pages so each package shows an
 * appropriate product mockup instead of a generic gradient block.
 */
import type { ThumbKind } from "@/lib/website/marketplace-packages";

const MAP: Record<string, ThumbKind> = {
  website_design: "website",
  ecommerce_setup: "ecommerce",
  mobile_app_design: "mobile",
  logo_design: "logo",
  branding: "branding",
  business_card_design: "branding",
  page_layout: "flyer",
  flyer_design: "flyer",
  menu_design: "menu",
  social_media_content: "social",
  online_advertising: "social",
  seo_local_visibility: "seo",
  data_entry: "data",
  virtual_assistance: "data",
  automation_setup: "automation",
  ai_tool_setup: "ai",
  content_writing: "branding",
};

export function thumbForCategory(category: string | undefined | null): ThumbKind {
  if (!category) return "website";
  return MAP[category] ?? "website";
}

export function altForCategory(category: string | undefined | null, title: string): string {
  const kind = thumbForCategory(category);
  const map: Record<ThumbKind, string> = {
    website: "Website mockup preview",
    ecommerce: "Online store mockup preview",
    mobile: "Mobile app screen preview",
    logo: "Logo design board preview",
    branding: "Brand identity board preview",
    social: "Social media post preview",
    seo: "SEO dashboard preview",
    data: "Data entry spreadsheet preview",
    menu: "Restaurant menu preview",
    flyer: "Flyer design preview",
    automation: "Automation workflow preview",
    ai: "AI assistant dashboard preview",
  };
  return `${map[kind]} — ${title}`;
}
