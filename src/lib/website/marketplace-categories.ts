/** Mirrors backend/src/seed/marketplaceCategories.ts so the frontend works
 *  even when the backend is offline. */
export interface MarketplaceCategory {
  slug: string;
  name: string;
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { slug: "logo_design", name: "Logo Design" },
  { slug: "website_design", name: "Website Design" },
  { slug: "mobile_app_design", name: "Mobile App Design" },
  { slug: "branding", name: "Branding" },
  { slug: "business_card_design", name: "Business Card Design" },
  { slug: "page_layout", name: "Page Layout" },
  { slug: "data_entry", name: "Data Entry" },
  { slug: "virtual_assistance", name: "Virtual Assistance" },
  { slug: "social_media_content", name: "Social Media Content" },
  { slug: "online_advertising", name: "Online Advertising" },
  { slug: "seo_local_visibility", name: "SEO & Local Visibility" },
  { slug: "automation_setup", name: "Automation Setup" },
  { slug: "ai_tool_setup", name: "AI Tool Setup" },
  { slug: "content_writing", name: "Content Writing" },
  { slug: "menu_design", name: "Menu Design" },
  { slug: "flyer_design", name: "Flyer Design" },
  { slug: "ecommerce_setup", name: "Ecommerce Setup" },
];

export function getCategory(slug: string): MarketplaceCategory | undefined {
  return MARKETPLACE_CATEGORIES.find((c) => c.slug === slug);
}