import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LISTING_SOURCE_LABELS, PHOTO_STATUS_LABELS, localToneForStatus } from "@/lib/local-listings/status";
import type { ListingPhotoSummary } from "@/lib/local-listings/types";

export function PhotoCard({ photo }: { photo: ListingPhotoSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-300">
          <ImageOff className="h-6 w-6" />
        </div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{photo.title ?? "Untitled photo"}</h3>
            <p className="text-[11px] text-slate-400">{photo.listingName ?? "Unlinked"}</p>
          </div>
          <Badge tone={localToneForStatus(photo.status)}>{PHOTO_STATUS_LABELS[photo.status] ?? photo.status}</Badge>
        </div>
        <p className="text-[11px] text-slate-400">
          <Badge tone="muted">{LISTING_SOURCE_LABELS[photo.source] ?? photo.source}</Badge>
          {" "}· {photo.imageUrl ?? "No image uploaded — internal placeholder"}
        </p>
      </CardBody>
    </Card>
  );
}
