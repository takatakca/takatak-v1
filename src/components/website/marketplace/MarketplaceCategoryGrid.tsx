import { Link } from "@/lib/website/nav";
import { MARKETPLACE_CATEGORIES } from "@/lib/website/marketplace-categories";
import {
  Palette, Globe2, Smartphone, Layers, FileText, ListChecks,
  ClipboardList, Headphones, Share2, Megaphone, Search, Workflow,
  Bot, PenLine, Utensils, Image as ImageIcon, Store,
} from "lucide-react";

const ICONS: Record<string, typeof Palette> = {
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
};

export function MarketplaceCategoryGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {MARKETPLACE_CATEGORIES.map((c) => {
        const Icon = ICONS[c.slug] ?? Store;
        return (
          <Link
            key={c.slug}
            to="/marketplace/category/$slug"
            params={{ slug: c.slug }}
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-[var(--shadow-card)] transition-all"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors">
              <Icon size={18} className="text-primary" />
            </div>
            <div className="mt-3 font-medium text-sm text-foreground">{c.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">Browse packages →</div>
          </Link>
        );
      })}
    </div>
  );
}