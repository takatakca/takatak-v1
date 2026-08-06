import {
  AtSign,
  BarChart3,
  Infinity,
  Link2,
  MessageSquare,
  Rss,
  Store,
} from "lucide-react";

import { FaInstagram, FaFacebook, FaTiktok, FaYoutube } from "react-icons/fa";

export type SocialPlatformKey =
  | "web"
  | "blog"
  | "facebook"
  | "instagram"
  | "threads"
  | "x"
  | "bluesky"
  | "linkedin"
  | "pinterest"
  | "tiktok"
  | "tiktok_business"
  | "google_business"
  | "youtube"
  | "twitch"
  | "meta_ads"
  | "google_ads"
  | "tiktok_ads"
  | "looker_studio";

function platformColor(
  platform: SocialPlatformKey,
): string {
  const colors: Record<
    SocialPlatformKey,
    string
  > = {
    web: "text-indigo-500",
    blog: "text-cyan-500",
    facebook: "text-[#1877F2]",
    instagram: "text-[#ff0069]",
    threads: "text-black",
    x: "text-black",
    bluesky: "text-[#1185fe]",
    linkedin: "text-[#0A66C2]",
    pinterest: "text-[#E60023]",
    tiktok: "text-black",
    tiktok_business: "text-black",
    google_business: "text-[#4285F4]",
    youtube: "text-[#FF0000]",
    twitch: "text-[#9146FF]",
    meta_ads: "text-[#0866FF]",
    google_ads: "text-[#4285F4]",
    tiktok_ads: "text-black",
    looker_studio: "text-[#6C63FF]",
  };

  return colors[platform];
}

export function SocialPlatformIcon({
  platform,
  className = "h-5 w-5",
  inverse = false,
}: {
  platform: SocialPlatformKey;
  className?: string;
  inverse?: boolean;
}) {
  const color = inverse
    ? "text-white"
    : platformColor(platform);

  const iconClassName =
    `${className} ${color}`;

  switch (platform) {
    case "web":
      return (
        <Link2
          aria-hidden="true"
          className={iconClassName}
        />
      );

    case "blog":
      return (
        <Rss
          aria-hidden="true"
          className={iconClassName}
        />
      );

    case "instagram":
      return (
        <FaInstagram
          aria-hidden="true"
          className={iconClassName}
        />
      );

    case "threads":
      return (
        <AtSign
          aria-hidden="true"
          className={iconClassName}
        />
      );

    case "tiktok":
    case "tiktok_business":
    case "tiktok_ads":
      return (
        <FaTiktok
          aria-hidden="true"
          className={iconClassName}
        />
      );

    case "google_business":
      return (
        <Store
          aria-hidden="true"
          className={iconClassName}
        />
      );

    case "youtube":
      return (
        <FaYoutube
          aria-hidden="true"
          className={iconClassName}
          fill="currentColor"
        />
      );

    case "twitch":
      return (
        <MessageSquare
          aria-hidden="true"
          className={iconClassName}
        />
      );

    case "meta_ads":
      return (
        <Infinity
          aria-hidden="true"
          className={iconClassName}
        />
      );

    case "google_ads":
    case "looker_studio":
      return (
        <BarChart3
          aria-hidden="true"
          className={iconClassName}
        />
      );

    case "facebook":
      return (
        <span
          aria-hidden="true"
          // className={`inline-flex ${className} items-center justify-center   ${color}`}
          className={iconClassName}
        >
          <FaFacebook size={25}/>
        </span>
      );

    // case "linkedin":
    //   return (
    //     <span
    //       aria-hidden="true"
    //       className={`inline-flex ${className} items-center justify-center text-[0.72em] font-black leading-none ${color}`}
    //     >
    //       in
    //     </span>
    //   );

    case "pinterest":
      return (
        <span
          aria-hidden="true"
          className={`inline-flex ${className} items-center justify-center text-[1.1em] font-black italic leading-none ${color}`}
        >
          P
        </span>
      );

    case "x":
      return (
        <span
          aria-hidden="true"
          className={`inline-flex ${className} items-center justify-center text-[0.95em] font-black leading-none ${color}`}
        >
          X
        </span>
      );

    case "bluesky":
      return (
        <span
          aria-hidden="true"
          className={`inline-flex ${className} items-center justify-center text-[0.62em] font-black uppercase leading-none ${color}`}
        >
          BS
        </span>
      );
  }
}
