"use client";

import { Check, ChevronDown, Gem, Loader2, Megaphone, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaFacebook,
  FaGoogle,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaTiktok,
  FaTwitch,
  FaYoutube,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

import { requestSocialBrandSelectorRefresh } from "@/components/social/navigation/social-brand-selector-events";
import { brandInitials } from "@/lib/brands/brand-display-image";
import type { BrandSettingsBrandCard } from "@/lib/brands/brand-settings-data";

const PLATFORM_ROW = [
  "twitch",
  "meta_ads",
  "google_ads",
  "google_business",
  "instagram",
  "youtube",
  "tiktok",
  "linkedin",
  "pinterest",
  "x",
  "facebook",
] as const;

const MUTED = "#d5d5d5";

const AVATAR_COLORS = [
  "#0f766e",
  "#eab308",
  "#dc2626",
  "#3f3f46",
  "#4f46e5",
  "#c026d3",
];

function nextBrandName(names: readonly string[]): string {
  const used = new Set(names.map((name) => name.trim().toLowerCase()));
  let index = 1;
  while (used.has(`brand ${index}`)) {
    index += 1;
  }
  return `Brand ${index}`;
}

function avatarColor(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
}

function NetworkIcon({
  platform,
  connected,
}: {
  platform: (typeof PLATFORM_ROW)[number];
  connected: boolean;
}) {
  const color = connected
    ? {
        twitch: "#9146FF",
        meta_ads: "#0866FF",
        google_ads: "#4285F4",
        google_business: "#4285F4",
        instagram: "#E1306C",
        youtube: "#FF0000",
        tiktok: "#111111",
        linkedin: "#0A66C2",
        pinterest: "#E60023",
        x: "#111111",
        facebook: "#1877F2",
      }[platform]
    : MUTED;

  const iconClass = "h-[13px] w-[13px] shrink-0";

  switch (platform) {
    case "twitch":
      return <FaTwitch className={iconClass} color={color} />;
    case "meta_ads":
      return (
        <Megaphone
          className={iconClass}
          color={color}
          strokeWidth={2.2}
        />
      );
    case "google_ads":
    case "google_business":
      return <FaGoogle className={iconClass} color={color} />;
    case "instagram":
      return <FaInstagram className={iconClass} color={color} />;
    case "youtube":
      return <FaYoutube className={iconClass} color={color} />;
    case "tiktok":
      return <FaTiktok className={iconClass} color={color} />;
    case "linkedin":
      return <FaLinkedin className={iconClass} color={color} />;
    case "pinterest":
      return <FaPinterest className={iconClass} color={color} />;
    case "x":
      return <FaXTwitter className={iconClass} color={color} />;
    case "facebook":
      return <FaFacebook className={iconClass} color={color} />;
  }
}

function BrandMark({ brand }: { brand: BrandSettingsBrandCard }) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(brand.displayImageUrl) && !broken;

  return (
    <span
      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-[12px] font-bold text-white"
      style={showImage ? undefined : { backgroundColor: avatarColor(brand.id) }}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.displayImageUrl!}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        brandInitials(brand.displayLabel || brand.name) || "—"
      )}
    </span>
  );
}

export function AddBrandsModal({
  open,
  brands,
  activeBrandId,
  canAddBrand,
  brandAllowance,
  hasPaidPlan,
  billingHref,
  usersHref,
  onClose,
  onSelectBrand,
  onCreated,
}: {
  open: boolean;
  brands: BrandSettingsBrandCard[];
  activeBrandId: string | null;
  canAddBrand: boolean;
  brandAllowance: number;
  hasPaidPlan: boolean;
  billingHref: string;
  usersHref: string;
  onClose: () => void;
  onSelectBrand: (brandId: string) => void;
  onCreated: (brandId: string) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setMessage(null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 40);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return brands;
    }

    return brands.filter((brand) => {
      const haystack = `${brand.displayLabel} ${brand.name}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [brands, query]);

  async function createBrand() {
    if (!canAddBrand || creating) {
      setMessage(
        canAddBrand
          ? null
          : brandAllowance === 0
            ? "This workspace cannot add brands while Social access is locked."
            : "You need an upgraded plan to add more brands to your TAKATAK account.",
      );
      return;
    }

    setCreating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextBrandName(brands.map((brand) => brand.name)),
          country: "Canada",
          timezone: "America/Toronto",
          status: "active",
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        brand?: { id?: string };
      };

      if (!response.ok || !result.ok || !result.brand?.id) {
        setMessage(result.message ?? "The brand could not be created.");
        return;
      }

      requestSocialBrandSelectorRefresh();
      onCreated(result.brand.id);
    } catch {
      setMessage(
        "A network error occurred. Check your connection and try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  if (!open) {
    return null;
  }

  const subscribed = hasPaidPlan;
  const bodyCopy = subscribed
    ? canAddBrand
      ? "Add another brand to this workspace. Each brand keeps its own connected accounts, image, and settings."
      : brandAllowance === 0
        ? "This workspace cannot add brands while Social access is locked."
        : "You need an upgraded plan to add more brands to your TAKATAK account."
    : "You need an upgraded plan to add more brands to your TAKATAK account.";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-brands-title"
    >
      <button
        type="button"
        aria-label="Close add brands"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-[980px]">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute -right-3 -top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1c1c] text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition hover:bg-black"
        >
          <X className="h-[15px] w-[15px]" strokeWidth={2.6} />
        </button>

        <section className="overflow-hidden rounded-[18px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
          <div className="grid md:grid-cols-[minmax(0,1fr)_400px]">
            <div className="flex min-h-[488px] flex-col px-10 py-8 sm:px-12">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
                  <Gem className="h-3.5 w-3.5" />
                </span>
                <h2
                  id="add-brands-title"
                  className="text-[22px] font-bold tracking-tight text-[#1d1d1f]"
                >
                  Add brands
                </h2>
              </div>

              <p className="mt-6 max-w-[340px] text-[15px] leading-6 text-[#5b5b5b]">
                {bodyCopy}
              </p>

              {!subscribed ? (
                <div className="mt-8 max-w-[360px]">
                  <p className="text-[15px] font-medium text-[#1d1d1f]">
                    With an upgraded plan, you also get:
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {[
                      "LinkedIn page connection",
                      "Access to limited analytics of X",
                      "Downloadable reports of your analytics in PDF format",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-[14px] leading-5 text-[#4b4b4b]"
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#3b82f6]">
                          <Check
                            className="h-2.5 w-2.5 text-white"
                            strokeWidth={3}
                          />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {message ? (
                <p className="mt-4 max-w-[340px] text-sm text-rose-700">
                  {message}
                </p>
              ) : null}

              <div className={`mt-auto flex flex-wrap items-center gap-3 ${subscribed ? "pt-16" : "pt-8"}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 min-w-[118px] items-center justify-center rounded-md border border-[#d0d0d0] bg-white px-4 text-[14px] font-medium text-[#1d1d1f] transition hover:bg-slate-50"
                >
                  Maybe later
                </button>
                <Link
                  href={billingHref}
                  onClick={onClose}
                  className="inline-flex h-10 min-w-[148px] items-center justify-center gap-2 rounded-md bg-[#2a1728] px-4 text-[14px] font-semibold text-[#dfff32] transition hover:bg-[#3b2438]"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
                    <Gem className="h-2.5 w-2.5" />
                  </span>
                  Upgrade plan
                </Link>
              </div>
            </div>

            <div className="relative flex items-center justify-center overflow-hidden bg-[#e8e4f6] px-8 py-10">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c9b7f5] blur-[48px]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#ddd6f5]/80 via-[#e4eaf8]/50 to-[#d7e6f7]/90" />

              {subscribed ? (
                <div className="relative w-full max-w-[320px] overflow-hidden rounded-[16px] bg-white p-3.5 shadow-[0_18px_40px_rgba(88,70,160,0.22)]">
                <label className="sr-only" htmlFor="add-brands-search">
                  Search a brand
                </label>
                <input
                  id="add-brands-search"
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search a brand"
                  className="h-10 w-full rounded-[10px] border border-[#e4e4e4] px-3 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#b3b3b3] focus:border-[#cfcfcf]"
                />

                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void createBrand()}
                  className="mt-2 flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left text-[14px] font-medium text-[#1d1d1f] transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-[10px] p-[1.5px]"
                    style={{
                      background:
                        "linear-gradient(135deg, #4b8bf5 0%, #f6a15c 100%)",
                    }}
                  >
                    <span className="flex h-full w-full items-center justify-center rounded-[8.5px] bg-white text-[#1d1d1f]">
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-[18px] w-[18px]" strokeWidth={1.8} />
                      )}
                    </span>
                  </span>
                  Add brand
                </button>

                <div
                  ref={listRef}
                  className="mt-0.5 max-h-[292px] overflow-y-auto"
                >
                  {filtered.map((brand) => {
                    const selected = brand.id === activeBrandId;
                    const connected = new Set(
                      brand.connectedPlatforms.map((platform) =>
                        platform.toLowerCase(),
                      ),
                    );

                    return (
                      <div
                        key={brand.id}
                        className={`flex items-center gap-1 rounded-[10px] ${
                          selected ? "bg-[#f0f7ff]" : "hover:bg-slate-50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectBrand(brand.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-1 py-2.5 text-left"
                        >
                          <BrandMark brand={brand} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-semibold leading-5 text-[#1d1d1f]">
                              {brand.displayLabel || brand.name}
                            </span>
                            <span className="mt-1 flex items-center gap-[3px] overflow-hidden">
                              {PLATFORM_ROW.map((platform) => (
                                <NetworkIcon
                                  key={platform}
                                  platform={platform}
                                  connected={connected.has(platform)}
                                />
                              ))}
                            </span>
                          </span>
                        </button>
                        <Link
                          href={usersHref}
                          onClick={onClose}
                          aria-label={`User management for ${brand.displayLabel || brand.name}`}
                          className="mr-1.5 shrink-0 rounded-md p-1.5 text-[#9aa0a6] transition hover:bg-white hover:text-slate-700"
                        >
                          <Users className="h-4 w-4" strokeWidth={1.8} />
                        </Link>
                      </div>
                    );
                  })}

                  {filtered.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">
                      {brands.length === 0
                        ? "No brands in this workspace yet."
                        : "No brands match that search."}
                    </p>
                  ) : null}
                </div>

                <div className="flex justify-center pt-1 text-[#c4c4c4]">
                  <ChevronDown className="h-4 w-4" strokeWidth={2} />
                </div>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/img/imgbrands.png"
                  alt=""
                  className="relative z-10 w-full max-w-[320px] drop-shadow-[0_18px_40px_rgba(88,70,160,0.28)]"
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
