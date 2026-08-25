import { Star } from "lucide-react";
import { ServiceThumbnail } from "./ServiceThumbnail";
import { thumbForCategory } from "@/lib/website/service-visuals";

export function GigCard({
  title,
  category,
  description,
}: {
  title: string;
  category: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
      <ServiceThumbnail kind={thumbForCategory(category)} />
      <div className="p-5">
        <div className="text-xs text-muted-foreground">{category}</div>
        <h4 className="mt-1 font-semibold">{title}</h4>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{description}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star size={12} className="fill-warning text-warning" />
            New
          </span>
          <span>Sample listing</span>
        </div>
      </div>
    </div>
  );
}