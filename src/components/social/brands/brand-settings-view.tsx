"use client";

import {
  Check,
  ChevronDown,
  CircleHelp,
  Gem,
  Loader2,
  Share2,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { FaLinkedin } from "react-icons/fa";

import { AddBrandsModal } from "@/components/social/brands/add-brands-modal";
import { BrandSettingsAi } from "@/components/social/brands/brand-settings-ai";
import { BrandSettingsConnections } from "@/components/social/brands/brand-settings-connections";
import { requestSocialBrandSelectorRefresh } from "@/components/social/navigation/social-brand-selector-events";
import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { brandInitials } from "@/lib/brands/brand-display-image";
import type {
  BrandSettingsAccountImage,
  BrandSettingsBrandCard,
  BrandSettingsPageData,
  BrandSettingsTab,
} from "@/lib/brands/brand-settings-data";
import type { EngagementRatioValue } from "@/lib/brands/brand-settings-validation";

const PLATFORM_KEYS: SocialPlatformKey[] = [
  "web",
  "blog",
  "facebook",
  "instagram",
  "threads",
  "x",
  "bluesky",
  "linkedin",
  "pinterest",
  "tiktok",
  "tiktok_business",
  "google_business",
  "youtube",
  "twitch",
  "meta_ads",
  "google_ads",
  "tiktok_ads",
  "looker_studio",
];

function platformKey(platform: string): SocialPlatformKey | null {
  const key = platform.trim().toLowerCase();
  return PLATFORM_KEYS.includes(key as SocialPlatformKey)
    ? (key as SocialPlatformKey)
    : null;
}

function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    threads: "Threads",
    tiktok: "TikTok",
    youtube: "YouTube",
    linkedin: "LinkedIn",
    pinterest: "Pinterest",
    x: "X",
    google_business: "Google Business",
    google: "Google",
  };
  return labels[platform] ?? platform;
}

function PlatformMark({
  platform,
  className = "h-4 w-4",
}: {
  platform: string;
  className?: string;
}) {
  if (platform === "linkedin") {
    return (
      <FaLinkedin
        aria-hidden="true"
        className={className}
        color="#0A66C2"
      />
    );
  }

  const key = platformKey(platform);
  if (!key) {
    return null;
  }

  return (
    <SocialPlatformIcon
      platform={key}
      className={className}
    />
  );
}

function BrandAvatar({
  name,
  imageUrl,
  empty = false,
  sizeClassName = "h-12 w-12",
}: {
  name: string;
  imageUrl: string | null | undefined;
  empty?: boolean;
  sizeClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(imageUrl) && !broken;

  if (empty && !showImage) {
    return (
      <span
        className={`relative flex shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-400 ${sizeClassName}`}
        aria-hidden="true"
      >
        <Tag className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-bold text-slate-600 ${sizeClassName}`}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        brandInitials(name) || "—"
      )}
    </span>
  );
}

export function BrandSettingsView({
  data,
  tab,
  canManageBrands,
  canManageSocial,
}: {
  data: BrandSettingsPageData;
  tab: BrandSettingsTab;
  canManageBrands: boolean;
  canManageSocial: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [viewAsTable, setViewAsTable] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setPickerOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (searchParams.get("addBrand") !== "1") {
      return;
    }

    setAddOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("addBrand");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  async function selectBrand(brandId: string) {
    setPickerOpen(false);
    setViewAsTable(false);

    try {
      const response = await fetch("/api/social/brand-context", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });

      if (!response.ok) {
        return;
      }

      requestSocialBrandSelectorRefresh();
      router.refresh();
    } catch {
      // Keep the current brand selected if the switch fails.
    }
  }

  function tabHref(next: BrandSettingsTab) {
    const path =
      next === "settings"
        ? "/dashboard/social/brands/settings"
        : `/dashboard/social/brands/settings?tab=${next}`;
    return withSocialPreview(path, searchParams);
  }

  if (data.source === "unavailable") {
    return (
      <section className="px-5 py-10 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Brand settings
        </h1>
        <p className="mt-2 text-sm text-slate-500">{data.message}</p>
      </section>
    );
  }

  const brands = data.brands;
  const activeIndex = Math.max(
    0,
    brands.findIndex((brand) => brand.id === data.activeBrandId),
  );
  const activeBrand =
    brands.find((brand) => brand.id === data.activeBrandId) ?? null;

  return (
    <div className="bg-white pb-16">
      <div className="px-5 pt-5 sm:px-6">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">
          Brand settings
        </h1>
      </div>

      <div className="px-5 sm:px-6">
      <section className="mt-5 rounded-2xl bg-[#f5fafd] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[15px]">
            <span className="font-semibold text-[#1d1d1f]">Brands</span>
            <span className="text-sm font-normal text-slate-500">
              {brands.length === 0 ? "0" : activeIndex + 1} of {brands.length}
            </span>
            <span
              title="Each brand keeps its own connected accounts, image, and engagement settings."
              className="text-slate-400"
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </div>

          {canManageBrands ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#f7fadf] px-4 text-sm font-medium text-[#1d1d1f] transition hover:bg-[#f1f5d0]"
            >
              + Add brand
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
                <Gem className="h-2.5 w-2.5" />
              </span>
            </button>
          ) : null}
        </div>

        {brands.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No brands in this workspace yet.
            {canManageBrands
              ? " Add a brand to configure its name, image, and connections."
              : ""}
          </p>
        ) : viewAsTable ? (
          <BrandTable
            brands={brands}
            activeBrandId={data.activeBrandId}
            onSelect={selectBrand}
          />
        ) : (
          <div ref={pickerRef} className="relative max-w-xl">
            <button
              type="button"
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
              onClick={() => setPickerOpen((current) => !current)}
              className="flex w-full items-center gap-3 rounded-xl border border-[#1d1d1f] bg-white px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <BrandAvatar
                name={activeBrand?.displayLabel ?? "Empty brand"}
                imageUrl={activeBrand?.displayImageUrl}
                empty={(activeBrand?.connectedPlatforms.length ?? 0) === 0}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-slate-900">
                  {activeBrand?.displayLabel ?? "Select a brand"}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  {(activeBrand?.connectedPlatforms ?? []).map((platform) => (
                    <PlatformMark key={platform} platform={platform} />
                  ))}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                  pickerOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {pickerOpen ? (
              <div
                role="listbox"
                className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              >
                {brands.map((brand) => {
                  const selected = brand.id === data.activeBrandId;
                  const empty = brand.connectedPlatforms.length === 0;
                  return (
                    <button
                      key={brand.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => void selectBrand(brand.id)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                        selected ? "bg-slate-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <BrandAvatar
                        name={brand.displayLabel}
                        imageUrl={brand.displayImageUrl}
                        empty={empty}
                        sizeClassName="h-10 w-10"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {brand.displayLabel}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {brand.connectedPlatforms.map((platform) => (
                            <PlatformMark
                              key={platform}
                              platform={platform}
                              className="h-3.5 w-3.5"
                            />
                          ))}
                        </span>
                      </span>
                      {selected ? (
                        <Check className="h-4 w-4 text-slate-600" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        {brands.length > 0 ? (
          <button
            type="button"
            onClick={() => setViewAsTable((current) => !current)}
            className="mt-3 text-[13px] font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            {viewAsTable ? "View as cards" : "View as table"}
          </button>
        ) : null}
      </section>

      <AddBrandsModal
        open={addOpen}
        brands={brands}
        activeBrandId={data.activeBrandId}
        canAddBrand={data.canAddBrand}
        brandAllowance={data.brandAllowance}
        hasPaidPlan={data.hasPaidPlan}
        billingHref={withSocialPreview(
          "/dashboard/social/settings?tab=billing",
          searchParams,
        )}
        usersHref={withSocialPreview(
          "/dashboard/social/users",
          searchParams,
        )}
        onClose={() => setAddOpen(false)}
        onSelectBrand={(brandId) => {
          void selectBrand(brandId);
        }}
        onCreated={(brandId) => {
          setAddOpen(false);
          void selectBrand(brandId);
        }}
      />

      <div className="mt-6 flex items-end justify-between border-b border-slate-300">
        <nav className="-mb-px flex gap-7" aria-label="Brand configuration">
          {(
            [
              ["settings", "Brand settings"],
              ["connections", "Connections"],
              ["ai", "AI Configuration"],
            ] as const
          ).map(([id, label]) => {
            const active = tab === id;
            return (
              <Link
                key={id}
                href={tabHref(id)}
                className={`border-b-2 px-0.5 pb-3 text-[15px] transition ${
                  active
                    ? "border-[#2a2a2a] font-semibold text-[#1d1d1f]"
                    : "border-transparent font-medium text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          aria-label="Copy page link"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href);
          }}
          className="mb-2 rounded-md p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {!data.brand ? (
        <p className="mt-8 text-sm text-slate-500">
          Select a brand to configure its settings.
        </p>
      ) : tab === "connections" ? (
        <BrandSettingsConnections
          brandId={data.brand.id}
          brandName={data.brand.name}
          connections={data.brand.connections}
          providerConnections={data.brand.providerConnections}
          providers={data.brand.providers}
          canManage={canManageSocial}
        />
      ) : tab === "ai" ? (
        <BrandSettingsAi
          key={data.brand.id}
          brandId={data.brand.id}
          voices={data.brand.voices}
          connectedPlatforms={data.brand.connections.map(
            (connection) => connection.platform,
          )}
          canManage={canManageBrands}
        />
      ) : (
        <SettingsForm
          key={`${data.brand.id}:${data.brand.name}:${data.brand.imageSocialAccountId ?? ""}:${data.brand.engagementRatio}`}
          brandId={data.brand.id}
          name={data.brand.name}
          engagementRatio={data.brand.engagementRatio}
          imageSocialAccountId={data.brand.imageSocialAccountId}
          images={data.brand.images}
          canManage={canManageBrands}
        />
      )}
      </div>
    </div>
  );
}

function BrandTable({
  brands,
  activeBrandId,
  onSelect,
}: {
  brands: BrandSettingsBrandCard[];
  activeBrandId: string | null;
  onSelect: (brandId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5">Brand</th>
            <th className="px-4 py-2.5">Connections</th>
          </tr>
        </thead>
        <tbody>
          {brands.map((brand) => {
            const selected = brand.id === activeBrandId;
            return (
              <tr key={brand.id} className={selected ? "bg-slate-50" : "bg-white"}>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(brand.id)}
                    className="flex items-center gap-3 text-left"
                  >
                    <BrandAvatar
                      name={brand.displayLabel}
                      imageUrl={brand.displayImageUrl}
                      empty={brand.connectedPlatforms.length === 0}
                      sizeClassName="h-9 w-9"
                    />
                    <span className="font-medium text-slate-900">
                      {brand.displayLabel}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {brand.connectedPlatforms.map((platform) => (
                      <PlatformMark key={platform} platform={platform} />
                    ))}
                    {brand.connectedPlatforms.length === 0 ? (
                      <span className="text-xs text-slate-400">None</span>
                    ) : null}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SettingsForm({
  brandId,
  name,
  engagementRatio,
  imageSocialAccountId,
  images,
  canManage,
}: {
  brandId: string;
  name: string;
  engagementRatio: EngagementRatioValue;
  imageSocialAccountId: string | null;
  images: BrandSettingsAccountImage[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [brandName, setBrandName] = useState(name);
  const [ratio, setRatio] = useState<EngagementRatioValue>(engagementRatio);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(
    imageSocialAccountId,
  );
  const [applyAll, setApplyAll] = useState(false);
  const [ratioOpen, setRatioOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const ratioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ratioOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (
        ratioRef.current &&
        !ratioRef.current.contains(event.target as Node)
      ) {
        setRatioOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [ratioOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || loading) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setSuccess(false);
    setFieldErrors({});

    try {
      const response = await fetch(
        `/api/brands/${encodeURIComponent(brandId)}/settings`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: brandName,
            imageSocialAccountId: selectedImageId,
            engagementRatio: ratio,
            applyEngagementToAllBrands: applyAll,
          }),
        },
      );

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "Brand settings could not be saved.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setSuccess(true);
      setMessage(result.message ?? "Brand settings were saved.");
      requestSocialBrandSelectorRefresh();
      router.refresh();
    } catch {
      setMessage("A network error occurred. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8" noValidate>
      {message ? (
        <p
          className={`mb-5 rounded-lg px-4 py-3 text-sm ${
            success
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-semibold text-[#1d1d1f]">Name</h2>
            <p className="mt-1 text-sm text-slate-500">
              Define a name to properly identify this brand.
            </p>
            <label className="mt-4 block text-[13px] font-medium text-slate-700">
              Brand name
              <input
                name="name"
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                required
                maxLength={120}
                disabled={!canManage}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20 disabled:bg-slate-50"
              />
            </label>
            {fieldErrors.name ? (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.name}</p>
            ) : null}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1d1d1f]">
              Engagement
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              You can configure which ratio to use when calculating the
              engagement metric. This way you will be able to see how many
              interactions your publication has received, every 100 or 1000
              accounts reached.
            </p>

            <div ref={ratioRef} className="relative mt-4 max-w-md">
              <p className="text-[13px] font-medium text-slate-700">
                Select how to display the engagement rate *
              </p>
              <button
                type="button"
                disabled={!canManage}
                aria-expanded={ratioOpen}
                onClick={() => setRatioOpen((current) => !current)}
                className={`mt-1.5 flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm text-slate-900 outline-none transition disabled:bg-slate-50 ${
                  ratioOpen
                    ? "border-[#4b8bf5] ring-2 ring-[#4b8bf5]/20"
                    : "border-slate-300"
                }`}
              >
                Ratio x {ratio}
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              {ratioOpen ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                  {([100, 1000] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setRatio(value);
                        setRatioOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-50"
                    >
                      Ratio x {value}
                      {ratio === value ? (
                        <Check className="h-4 w-4 text-slate-700" />
                      ) : (
                        <span className="h-4 w-4" />
                      )}
                    </button>
                  ))}
                </div>
              ) : null}
              {fieldErrors.engagementRatio ? (
                <p className="mt-1 text-xs text-rose-600">
                  {fieldErrors.engagementRatio}
                </p>
              ) : null}
            </div>

            <label className="mt-5 flex items-center gap-3 text-sm text-slate-700">
              <button
                type="button"
                role="switch"
                aria-checked={applyAll}
                disabled={!canManage}
                onClick={() => setApplyAll((current) => !current)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  applyAll ? "bg-[#2a1728]" : "bg-slate-300"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                    applyAll ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
              Save for all my brands
            </label>
          </section>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Image</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose an image from your connected accounts:
          </p>
          {images.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500">
              Connect a social account to choose a brand image.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              {images.map((image) => {
                const selected = selectedImageId === image.accountId;
                return (
                  <button
                    key={image.accountId}
                    type="button"
                    disabled={!canManage}
                    aria-pressed={selected}
                    title={
                      image.displayName ??
                      image.handle ??
                      platformLabel(image.platform)
                    }
                    onClick={() =>
                      setSelectedImageId((current) =>
                        current === image.accountId ? current : image.accountId,
                      )
                    }
                    className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 transition ${
                      selected
                        ? "border-[#2a1728] ring-2 ring-[#2a1728]/20"
                        : "border-transparent ring-1 ring-slate-200 hover:ring-slate-300"
                    }`}
                  >
                    {image.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image.imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-bold text-slate-500">
                        {brandInitials(
                          image.displayName ?? image.handle ?? image.platform,
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {fieldErrors.imageSocialAccountId ? (
            <p className="mt-2 text-xs text-rose-600">
              {fieldErrors.imageSocialAccountId}
            </p>
          ) : null}
        </section>
      </div>

      {canManage ? (
        <div className="mt-10 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 min-w-[148px] items-center justify-center rounded-md bg-[#2a1728] px-5 text-sm font-semibold text-white transition hover:bg-[#3b2438] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          You can view these settings, but you need permission to change them.
        </p>
      )}
    </form>
  );
}

