import Link from "next/link";
import {
  Bot,
  ClipboardList,
  FileText,
  Globe2,
  Headphones,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Megaphone,
  Palette,
  PenLine,
  Search,
  Share2,
  Smartphone,
  Store,
  Target,
  Utensils,
  Workflow,
} from "lucide-react";

import { MARKETPLACE_CATEGORIES } from "@/lib/website/marketplace-catalog";

const icons = {
  logo_design: Palette,
  website_design: Globe2,
  mobile_app_design: Smartphone,
  branding: Layers,
  business_card_design: FileText,
  page_layout: ListChecks,
  data_entry: ClipboardList,
  virtual_assistance: Headphones,
  social_media_content: Share2,
  online_advertising: Megaphone,
  seo_local_visibility: Search,
  automation_setup: Workflow,
  ai_tool_setup: Bot,
  content_writing: PenLine,
  menu_design: Utensils,
  flyer_design: ImageIcon,
  ecommerce_setup: Store,
  lead_generation: Target,
} as const;

export function MarketplaceCategoryGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {MARKETPLACE_CATEGORIES.map(
        (category) => {
          const Icon =
            icons[
              category.slug as keyof typeof icons
            ] ?? Store;

          return (
            <Link
              key={category.slug}
              href={`/marketplace/category/${category.slug}`}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-500/50 hover:shadow-md"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 transition group-hover:bg-emerald-50">
                <Icon
                  size={18}
                  className="text-emerald-700"
                />
              </span>

              <p className="mt-3 text-sm font-medium text-slate-950">
                {category.name}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Browse packages →
              </p>
            </Link>
          );
        },
      )}
    </div>
  );
}