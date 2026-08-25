import { Link } from "@/lib/website/nav";
import {
  TrendingUp, Palette, Code2, Megaphone, PenLine, Video,
  Briefcase, Bot, MapPin, Database,
} from "lucide-react";

const STRIP = [
  { icon: TrendingUp, label: "Trending", slug: "logo_design" },
  { icon: Palette, label: "Graphics & Design", slug: "logo_design" },
  { icon: Code2, label: "Programming & Tech", slug: "website_design" },
  { icon: Megaphone, label: "Digital Marketing", slug: "online_advertising" },
  { icon: PenLine, label: "Writing & Translation", slug: "content_writing" },
  { icon: Video, label: "Video & Animation", slug: "social_media_content" },
  { icon: Briefcase, label: "Business", slug: "virtual_assistance" },
  { icon: Bot, label: "AI Services", slug: "ai_tool_setup" },
  { icon: MapPin, label: "Local Visibility", slug: "seo_local_visibility" },
  { icon: Database, label: "Data", slug: "data_entry" },
];

export function MarketplaceCategoryStrip() {
  return (
    <nav aria-label="Categories" className="border-y border-border bg-background">
      <div className="max-w-7xl mx-auto px-4">
        <ul className="flex gap-1 overflow-x-auto py-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {STRIP.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.label} className="shrink-0">
                <Link
                  to="/marketplace/category/$slug"
                  params={{ slug: s.slug }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary whitespace-nowrap transition-colors"
                >
                  <Icon size={15} className="text-primary" />
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}