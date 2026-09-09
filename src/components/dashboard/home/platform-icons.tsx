import {
  FaFacebook,
  FaGoogle,
  FaInstagram,
  FaLinkedin,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { Globe, Megaphone, Star } from "lucide-react";
import { platformLabel } from "./format";

const SOCIAL_ICON_ORDER = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "youtube",
  "x",
  "threads",
  "google_business",
  "pinterest",
] as const;

export function sortLinkedPlatforms(platforms: string[]): string[] {
  const unique = [...new Set(platforms)];
  return unique.sort((a, b) => {
    const aIndex = SOCIAL_ICON_ORDER.indexOf(a as (typeof SOCIAL_ICON_ORDER)[number]);
    const bIndex = SOCIAL_ICON_ORDER.indexOf(b as (typeof SOCIAL_ICON_ORDER)[number]);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

function BrandMark({ platform, size }: { platform: string; size: number }) {
  switch (platform) {
    case "facebook":
    case "meta_ads":
      return <FaFacebook size={size} color="#1877F2" />;
    case "instagram":
      return <FaInstagram size={size} color="#E1306C" />;
    case "linkedin":
      return <FaLinkedin size={size} color="#0A66C2" />;
    case "tiktok":
      return <FaTiktok size={size} color="#111111" />;
    case "youtube":
      return <FaYoutube size={size} color="#FF0000" />;
    case "x":
      return <FaXTwitter size={size} color="#111111" />;
    case "google_business":
    case "google_ads":
    case "google":
      return <FaGoogle size={size} color="#4285F4" />;
    default:
      return (
        <span className="text-[10px] font-bold text-slate-600">
          {platformLabel(platform).charAt(0).toUpperCase()}
        </span>
      );
  }
}

export function LinkedPlatformIcon({
  platform,
  size = 14,
}: {
  platform: string;
  size?: number;
}) {
  return (
    <span
      title={platformLabel(platform)}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white ring-1 ring-slate-200"
    >
      <BrandMark platform={platform} size={size} />
    </span>
  );
}

export function IntegrationRowIcon({ rowKey }: { rowKey: "website" | "social" | "advertising" | "reviews" }) {
  if (rowKey === "social") {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]">
        <FaInstagram size={16} color="#fff" />
      </span>
    );
  }
  if (rowKey === "website") {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Globe className="h-4 w-4" />
      </span>
    );
  }
  if (rowKey === "advertising") {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
        <Megaphone className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
      <Star className="h-4 w-4 fill-amber-400" />
    </span>
  );
}
