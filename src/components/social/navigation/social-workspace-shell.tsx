"use client";

import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileBarChart2,
  Gem,
  Globe2,
  Handshake,
  Hash,
  Inbox,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Check,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { AddBrandsModal } from "@/components/social/brands/add-brands-modal";
import {
  ManageConnectionsModal,
  type ManageConnectionsConnection,
  type ManageConnectionsProvider,
} from "@/components/social/connections/manage-connections-modal";
import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import { SOCIAL_BRAND_SELECTOR_REFRESH_EVENT } from "@/components/social/navigation/social-brand-selector-events";
import { FaLinkedin } from "react-icons/fa";
import { brandInitials as resolveBrandInitials } from "@/lib/brands/brand-display-image";
import { pickConnectedPlatformAccount } from "@/lib/social/connections/social-selected-page-identity";
import { SocialBillingBanner } from "@/components/social/billing/social-billing-banner";
import type { SocialBillingBannerModel } from "@/lib/billing/social/billing-banner-policy";
import { SocialOnboardingModal } from "@/components/social/onboarding/social-onboarding-modal";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";

export interface SocialShellBrand {
  id: string;
  name: string;
  status: string;
  /** Explicit uploaded brand image; null if none. */
  imageUrl: string | null;
  /** Resolved display image (uploaded → social → null). */
  displayImageUrl: string | null;
  /** Page name when connected, else brand name. */
  displayLabel: string;
  /** Connected platform keys for icon row (no IDs). */
  connectedPlatforms: string[];
}

export interface SocialShellAccount {
  id: string;
  platform: string;
  handle: string | null;
  displayName: string | null;
  status: string;
  profileImageUrl: string | null;
}

export interface SocialShellData {
  activeBrandId: string | null;
  activeBrandName: string | null;
  /** Prefer connected Facebook Page name over demo brand name. */
  activeBrandDisplayLabel: string | null;
  activeBrandDisplayImageUrl: string | null;
  brands: SocialShellBrand[];
  accounts: SocialShellAccount[];
  providers: ManageConnectionsProvider[];
  connections: ManageConnectionsConnection[];
  canManageSocialAccounts: boolean;
  canManageBrands: boolean;
  brandAllowance?: number;

  /*
   * Optional for now so the shell continues to work
   * before the billing data is passed by the layout.
   */
  planName?: string | null;
  hasPaidPlan?: boolean;
  billingBanner?: SocialBillingBannerModel | null;

  dataUnavailable: boolean;
}

interface SocialWorkspaceShellProps {
  children: ReactNode;
  data: SocialShellData;
}

interface StarterPlatform {
  platform: SocialPlatformKey;
  accountPlatform: string;
  label: string;
  href: string;
  premium: boolean;
}

function isSocialSettingsPage(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/social/settings") ||
    pathname.startsWith("/dashboard/social/brands") ||
    pathname.startsWith("/dashboard/social/users") ||
    pathname.startsWith("/dashboard/social/approvals") ||
    pathname.startsWith("/dashboard/social/reports") ||
    pathname.startsWith("/dashboard/social/inbox") ||
    pathname.startsWith("/dashboard/social/calendar")
  );
}

function isAnalyticsPath(pathname: string): boolean {
  if (isSocialSettingsPage(pathname)) {
    return false;
  }

  return (
    pathname === "/dashboard/social" ||
    pathname.startsWith("/dashboard/social/")
  );
}

const TOP_NAVIGATION = [
  {
    label: "Analytics",
    href: "/dashboard/social",
    icon: BarChart3,
    enabled: true,
  },
  {
    label: "Reporting",
    href: "/dashboard/social/reports",
    icon: FileBarChart2,
    enabled: true,
  },
  {
    label: "Inbox",
    href: "/dashboard/social/inbox",
    icon: Inbox,
    enabled: true,
  },
  {
    label: "Planning",
    href: "/dashboard/social/calendar",
    icon: CalendarDays,
    enabled: true,
  },
  {
    label: "SmartLinks",
    href: "/dashboard/social/smartlinks",
    icon: Link2,
    enabled: false,
  },
  {
    label: "Ads",
    href: "/dashboard/social/campaigns",
    icon: Megaphone,
    enabled: false,
  },
] as const;

const STARTER_PLATFORMS: StarterPlatform[] = [
  {
    platform: "instagram",
    accountPlatform: "instagram",
    label: "Instagram",
    href: "/dashboard/social/instagram",
    premium: false,
  },
  {
    platform: "facebook",
    accountPlatform: "facebook",
    label: "Facebook",
    href: "/dashboard/social/facebook",
    premium: false,
  },
  {
    platform: "tiktok",
    accountPlatform: "tiktok",
    label: "TikTok",
    href: "/dashboard/social/tiktok",
    premium: false,
  },
  {
    platform: "youtube",
    accountPlatform: "youtube",
    label: "YouTube",
    href: "/dashboard/social/youtube",
    premium: false,
  },
  {
    platform: "linkedin",
    accountPlatform: "linkedin",
    label: "LinkedIn",
    href: "/dashboard/social/linkedin",
    premium: true,
  },
];

function normalizePlatform(
  platform: string,
): SocialPlatformKey | null {
  const supported: SocialPlatformKey[] = [
    "facebook",
    "instagram",
    "threads",
    "x",
    "bluesky",
    "linkedin",
    "pinterest",
    "tiktok",
    "google_business",
    "youtube",
    "twitch",
  ];

  return supported.includes(
    platform as SocialPlatformKey,
  )
    ? (platform as SocialPlatformKey)
    : null;
}

function platformLabel(
  platform: string,
): string {
  const labels: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    threads: "Threads",
    tiktok: "TikTok",
    google_business:
      "Google Business Profile",
    linkedin: "LinkedIn",
    x: "X",
    youtube: "YouTube",
    pinterest: "Pinterest",
    bluesky: "Bluesky",
    twitch: "Twitch",
  };

  return (
    labels[platform] ??
    platform.replaceAll("_", " ")
  );
}

function platformPageHref(
  platform: string,
): string {
  return `/dashboard/social/${encodeURIComponent(
    platform,
  )}`;
}

function brandInitials(
  name: string,
): string {
  return resolveBrandInitials(name);
}

function toPlatformIconKey(
  platform: string,
): SocialPlatformKey | null {
  const key = platform.trim().toLowerCase();
  const allowed: SocialPlatformKey[] = [
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

  return allowed.includes(key as SocialPlatformKey)
    ? (key as SocialPlatformKey)
    : null;
}

function BrandAvatar({
  name,
  imageUrl,
  empty = false,
  sizeClassName = "h-8 w-8",
  roundedClassName = "rounded-full",
}: {
  name: string;
  imageUrl: string | null | undefined;
  empty?: boolean;
  sizeClassName?: string;
  roundedClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(imageUrl) && !broken;

  // Metricool empty brands use a soft tag glyph, not initials.
  if (empty && !showImage) {
    return (
      <span
        className={`relative flex shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-400 ${sizeClassName} ${roundedClassName}`}
        aria-hidden="true"
      >
        <Tag className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-slate-200 text-xs font-bold text-slate-600 ${sizeClassName} ${roundedClassName}`}
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

function ConnectedPlatformIcons({
  platforms,
}: {
  platforms: string[];
}) {
  if (platforms.length === 0) {
    return null;
  }

  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {platforms.map((platform) => {
        const key = toPlatformIconKey(platform);
        if (!key) return null;
        return (
          <SocialPlatformIcon
            key={platform}
            platform={key}
            className="h-3.5 w-3.5"
          />
        );
      })}
    </span>
  );
}

function BrandSelector({
  data,
}: {
  data: SocialShellData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [brands, setBrands] = useState(data.brands);
  const [activeBrandId, setActiveBrandId] = useState(
    data.activeBrandId,
  );
  const [activeDisplayLabel, setActiveDisplayLabel] = useState(
    data.activeBrandDisplayLabel ?? data.activeBrandName,
  );
  const [activeDisplayImageUrl, setActiveDisplayImageUrl] =
    useState(data.activeBrandDisplayImageUrl);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [tipPos, setTipPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    setBrands(data.brands);
    setActiveBrandId(data.activeBrandId);
    setActiveDisplayLabel(
      data.activeBrandDisplayLabel ?? data.activeBrandName,
    );
    setActiveDisplayImageUrl(data.activeBrandDisplayImageUrl);
  }, [
    data.brands,
    data.activeBrandId,
    data.activeBrandName,
    data.activeBrandDisplayLabel,
    data.activeBrandDisplayImageUrl,
  ]);

  useEffect(() => {
    const node = nameRef.current;
    if (!node) return;

    const measure = () => {
      setTruncated(node.scrollWidth > node.clientWidth + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeDisplayLabel]);

  function updateTooltipPosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Metricool: white tip sits to the LEFT of the trigger, vertically centered.
    setTipPos({
      top: rect.top + rect.height / 2,
      left: Math.max(8, rect.left - 10),
    });
  }

  function isNameTruncated() {
    const node = nameRef.current;
    if (!node) return truncated;
    return node.scrollWidth > node.clientWidth + 1;
  }

  function openTooltip() {
    const overflow = isNameTruncated();
    setTruncated(overflow);
    if (!overflow) return;
    updateTooltipPosition();
    setShowTip(true);
  }

  function closeTooltip() {
    setShowTip(false);
  }

  async function refreshBrandSnapshot(force = false) {
    if (!force) {
      const cachedAt = (refreshBrandSnapshot as { _at?: number })._at;
      if (cachedAt && Date.now() - cachedAt < 8_000) {
        return;
      }
    }

    if ((refreshBrandSnapshot as { _inflight?: Promise<void> })._inflight) {
      await (refreshBrandSnapshot as { _inflight?: Promise<void> })._inflight;
      return;
    }

    setLoadingBrands(true);
    const work = (async () => {
      try {
        const response = await fetch("/api/social/brand-selector", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as {
          ok?: boolean;
          brands?: SocialShellBrand[];
        } | null;

        if (!response.ok || !body?.ok || !Array.isArray(body.brands)) {
          return;
        }

        setBrands(body.brands);
        (refreshBrandSnapshot as { _at?: number })._at = Date.now();
        const active =
          body.brands.find((brand) => brand.id === activeBrandId) ??
          body.brands.find(
            (brand) => brand.id === data.activeBrandId,
          ) ??
          null;
        if (active) {
          setActiveBrandId(active.id);
          setActiveDisplayLabel(active.displayLabel || active.name);
          setActiveDisplayImageUrl(active.displayImageUrl);
        }
      } catch {
        // Keep last known snapshot; router.refresh still reconciles.
      } finally {
        setLoadingBrands(false);
      }
    })();

    (refreshBrandSnapshot as { _inflight?: Promise<void> })._inflight = work;
    try {
      await work;
    } finally {
      delete (refreshBrandSnapshot as { _inflight?: Promise<void> })._inflight;
    }
  }

  useEffect(() => {
    function onRefresh() {
      void refreshBrandSnapshot();
    }

    window.addEventListener(
      SOCIAL_BRAND_SELECTOR_REFRESH_EVENT,
      onRefresh,
    );
    return () => {
      window.removeEventListener(
        SOCIAL_BRAND_SELECTOR_REFRESH_EVENT,
        onRefresh,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrandId, data.activeBrandId]);

  useEffect(() => {
    if (!open) return;

    void refreshBrandSnapshot();

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function updateBrand(brandId: string) {
    setMessage(null);

    try {
      const response = await fetch("/api/social/brand-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });

      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setMessage(
          result?.message ?? "The brand could not be changed.",
        );
        return;
      }

      const next = brands.find((brand) => brand.id === brandId);
      if (next) {
        setActiveBrandId(next.id);
        setActiveDisplayLabel(next.displayLabel || next.name);
        setActiveDisplayImageUrl(next.displayImageUrl);
      }

      setOpen(false);
      router.refresh();
    } catch {
      setMessage("The brand could not be changed.");
    }
  }

  const collapsedName =
    activeDisplayLabel ?? "Empty brand";
  const activeBrand = brands.find(
    (brand) => brand.id === activeBrandId,
  );
  const activeIsEmpty =
    (activeBrand?.connectedPlatforms.length ?? 0) === 0 &&
    !activeDisplayImageUrl;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={collapsedName}
        title={truncated ? collapsedName : undefined}
        className={`flex h-11 min-w-[200px] max-w-[260px] items-center gap-2.5 rounded-lg border px-2 text-left transition ${
          open
            ? "border-white/30 bg-[#766f75]"
            : "border-white/10 bg-white/10 hover:bg-white/15"
        }`}
      >
        <BrandAvatar
          name={collapsedName}
          imageUrl={activeDisplayImageUrl}
          empty={activeIsEmpty}
          sizeClassName="h-8 w-8"
          roundedClassName="rounded-full"
        />

        <span
          ref={nameRef}
          className="min-w-0 flex-1 truncate text-sm font-medium text-white"
        >
          {collapsedName}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {showTip && tipPos && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[300] max-w-[280px] -translate-x-full -translate-y-1/2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium leading-snug text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
              style={{
                top: tipPos.top,
                left: tipPos.left,
              }}
            >
              {collapsedName}
            </span>,
            document.body,
          )
        : null}

      {open ? (
        <div
          role="listbox"
          aria-label="Brands"
          className="absolute right-0 top-[52px] z-50 w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.22)]"
        >
          {data.canManageBrands ? (
            <Link
              href={withSocialPreview(
                "/dashboard/social?addBrand=1",
                searchParams,
              )}
              onClick={() => {
                setOpen(false);
              }}
              className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-[15px] font-medium text-slate-900 transition hover:bg-slate-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-800">
                <Plus className="h-5 w-5" strokeWidth={2} />
              </span>
              Add brand
            </Link>
          ) : null}

          <div className="max-h-80 overflow-y-auto py-1">
            {loadingBrands && brands.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">
                Loading brands…
              </p>
            ) : null}

            {brands.map((brand) => {
              const selected = brand.id === activeBrandId;
              const isEmpty = brand.connectedPlatforms.length === 0;
              const label = isEmpty
                ? "Empty brand"
                : brand.displayLabel || brand.name;

              return (
                <button
                  key={brand.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={isPending}
                  onClick={() => {
                    startTransition(() => {
                      void updateBrand(brand.id);
                    });
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition disabled:cursor-wait ${
                    selected
                      ? "bg-[#ececee]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <BrandAvatar
                    name={label}
                    imageUrl={brand.displayImageUrl}
                    empty={isEmpty}
                    sizeClassName="h-10 w-10"
                    roundedClassName="rounded-full"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {label}
                    </span>
                    <ConnectedPlatformIcons
                      platforms={brand.connectedPlatforms}
                    />
                  </span>

                  {selected ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-slate-600"
                      aria-label="Selected"
                    />
                  ) : (
                    <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}

            {brands.length === 0 && !loadingBrands ? (
              <p className="px-4 py-5 text-sm text-slate-500">
                No brands are available in this workspace.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="absolute right-0 top-14 z-50 w-72 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-lg">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function TakatakMark() {
  return (
    <span
      className="relative flex h-9 w-12 items-center justify-center"
      aria-hidden="true"
    >
      <span className="absolute left-1.5 h-4 w-6 rotate-[-35deg] rounded-full border-[5px] border-white" />
      <span className="absolute right-1.5 h-4 w-6 rotate-[35deg] rounded-full border-[5px] border-white" />
    </span>
  );
}

function DrawerRow({
  label,
  href,
  icon: Icon,
  premiumLocked = false,
  languageCode,
  showChevron = false,
  disabled = false,
  active = false,
  onClose,
}: {
  label: string;
  href?: string;
  icon: typeof Settings2;
  premiumLocked?: boolean;
  languageCode?: string;
  showChevron?: boolean;
  disabled?: boolean;
  active?: boolean;
  onClose: () => void;
}) {
  const rowClassName = `flex min-h-[46px] w-full items-center gap-2.5 px-4 text-left text-[14px] font-normal transition-colors ${
    active
      ? "bg-[#e8ecee] text-slate-950"
      : premiumLocked
        ? "bg-[#f7fadf] text-[#2a2a2a]"
        : "bg-white text-[#2a2a2a] hover:bg-slate-50"
  } ${
    disabled
      ? "cursor-default"
      : "cursor-pointer"
  }`;

  const content = (
    <>
      {premiumLocked ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dfff32] text-[#2a1728]">
          <Gem className="h-4 w-4" />
        </span>
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[#5368ff]">
          <Icon
            className="h-[18px] w-[18px]"
            strokeWidth={1.9}
          />
        </span>
      )}

      <span className="min-w-0 flex-1 truncate">
        {label}
      </span>

      {languageCode ? (
        <span className="inline-flex h-6 min-w-8 items-center justify-center rounded bg-[#d8e7ec] px-1.5 text-[11px] font-medium text-[#26343d]">
          {languageCode}
        </span>
      ) : null}

      {showChevron ? (
        <ChevronRight
          className="h-[18px] w-[18px] shrink-0 text-[#5368ff]"
          strokeWidth={1.8}
        />
      ) : null}
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        onClick={onClose}
        className={rowClassName}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={rowClassName}
    >
      {content}
    </button>
  );
}

const SOCIAL_LANGUAGES = [
  {
    label: "English",
    code: "EN",
  },
  {
    label: "Español",
    code: "ES",
  },
  {
    label: "Français",
    code: "FR",
  },
  {
    label: "Português (Portugal)",
    code: "PT",
  },
  {
    label: "Português (Brasil)",
    code: "BR",
  },
  {
    label: "Deutsch",
    code: "DE",
  },
  {
    label: "Italiano",
    code: "IT",
  },
  {
    label: "Dansk",
    code: "DA",
  },
  {
    label: "Nederlands",
    code: "NL",
  },
] as const;

function LanguageFlyout() {
  const anchorRef =
    useRef<HTMLButtonElement | null>(
      null,
    );

  const closeTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const [open, setOpen] =
    useState(false);

  const [position, setPosition] =
    useState({
      top: 12,
      right: 348,
    });

  function cancelClose() {
    if (closeTimerRef.current) {
      clearTimeout(
        closeTimerRef.current,
      );

      closeTimerRef.current = null;
    }
  }

  function updatePosition() {
    const anchor =
      anchorRef.current;

    if (!anchor) {
      return;
    }

    const rectangle =
      anchor.getBoundingClientRect();

    const availableHeight =
      window.innerHeight - 24;

    const estimatedPanelHeight =
      Math.min(
        570,
        availableHeight,
      );

    const top = Math.max(
      12,
      Math.min(
        rectangle.top - 12,
        window.innerHeight -
          estimatedPanelHeight -
          12,
      ),
    );

    setPosition({
      top,
      right:
        window.innerWidth -
        rectangle.left +
        12,
    });
  }

  function openMenu() {
    cancelClose();
    updatePosition();
    setOpen(true);
  }

  function scheduleClose() {
    cancelClose();

    closeTimerRef.current =
      setTimeout(() => {
        setOpen(false);
      }, 140);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePositionChange() {
      updatePosition();
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener(
      "resize",
      handlePositionChange,
    );

    window.addEventListener(
      "scroll",
      handlePositionChange,
      true,
    );

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handlePositionChange,
      );

      window.removeEventListener(
        "scroll",
        handlePositionChange,
        true,
      );

      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [open]);

  useEffect(() => {
    return () => {
      cancelClose();
    };
  }, []);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onFocus={openMenu}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
        className={`flex min-h-[46px] w-full items-center gap-2.5 px-4 text-left text-[14px] font-normal transition-colors ${
          open
            ? "bg-[#e8edf0] text-[#2a2a2a]"
            : "bg-white text-[#2a2a2a] hover:bg-slate-50"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[#5368ff]">
          <Globe2
            className="h-[18px] w-[18px]"
            strokeWidth={1.9}
          />
        </span>

        <span className="min-w-0 flex-1 truncate">
          Language
        </span>

        <span className="inline-flex h-6 min-w-8 items-center justify-center rounded bg-[#d8e7ec] px-1.5 text-[11px] font-medium text-[#26343d]">
          EN
        </span>

        <ChevronRight
          className={`h-[18px] w-[18px] shrink-0 text-[#5368ff] transition-transform ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={1.8}
        />
      </button>

      {open &&
      typeof document !==
        "undefined"
        ? createPortal(
            <div
              role="menu"
              aria-label="Select language"
              onMouseEnter={
                cancelClose
              }
              onMouseLeave={
                scheduleClose
              }
              style={{
                top: position.top,
                right: position.right,
              }}
              className="fixed z-[120] w-[300px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.22)]"
            >
              <div className="max-h-[calc(100vh-24px)] overflow-y-auto py-2">
                {SOCIAL_LANGUAGES.map(
                  (language) => {
                    const selected =
                      language.code ===
                      "EN";

                    return (
                      <button
                        key={
                          language.code
                        }
                        type="button"
                        role="menuitem"
                        disabled={
                          !selected
                        }
                        title={
                          selected
                            ? "Current language"
                            : `${language.label} translation is not enabled yet.`
                        }
                        className={`flex min-h-[48px] w-full items-center gap-3 px-5 text-left text-[15px] transition ${
                          selected
                            ? "bg-[#e4e9ed] font-semibold text-slate-950"
                            : "cursor-not-allowed bg-white text-slate-700"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          {
                            language.label
                          }{" "}
                          -{" "}
                          {
                            language.code
                          }
                        </span>

                        {selected ? (
                          <Check className="h-5 w-5 shrink-0 text-[#5368ff]" />
                        ) : null}
                      </button>
                    );
                  },
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ModuleDrawer({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: SocialShellData;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!open) {
    return null;
  }

  const premiumLocked =
    data.hasPaidPlan !== true;

  const settingsTab = searchParams.get("tab");
  const onBrandSettingsPage =
    pathname === "/dashboard/social/brands" ||
    pathname.startsWith("/dashboard/social/brands/");
  const connectionsActive =
    onBrandSettingsPage && settingsTab === "connections";
  const aiConfigurationActive =
    onBrandSettingsPage && settingsTab === "ai";
  const brandSettingsActive =
    onBrandSettingsPage &&
    settingsTab !== "connections" &&
    settingsTab !== "ai";

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close account menu"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/20"
      />

      <aside className="absolute bottom-0 right-0 top-0 flex w-[336px] max-w-[90vw] flex-col overflow-hidden rounded-bl-2xl bg-white shadow-[0_12px_36px_rgba(15,23,42,0.18)]">
        <header className="flex h-[62px] shrink-0 items-center justify-end bg-[#2a1728] px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 text-white transition hover:bg-white/15"
          >
            <X
              className="h-6 w-6"
              strokeWidth={1.8}
            />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          {/* Mobile top navigation */}
          <section className="border-b border-[#e5edef] py-1 lg:hidden">
            {TOP_NAVIGATION.map(
              (item) => {
                const Icon = item.icon;

                const active =
                  item.label === "Analytics"
                    ? isAnalyticsPath(pathname)
                    : pathname.startsWith(item.href);

                const navigationContent = (
                  <>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[#5368ff]">
                      <Icon
                        className="h-[19px] w-[19px]"
                        strokeWidth={1.9}
                      />
                    </span>

                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                    </span>

                    {item.label ===
                    "Reporting" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-700">
                        New
                      </span>
                    ) : null}
                  </>
                );

                if (!item.enabled) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled
                      title={`${item.label} will be activated when its real backend is implemented.`}
                      className="flex min-h-[46px] w-full cursor-not-allowed items-center gap-2.5 px-4 text-left text-[14px] text-slate-500 opacity-70"
                    >
                      {navigationContent}
                    </button>
                  );
                }

                const itemClassName = `flex min-h-[46px] w-full items-center gap-2.5 px-4 text-left text-[14px] font-medium transition ${
                  active
                    ? "bg-slate-200 text-slate-950"
                    : "text-[#2a2a2a] hover:bg-slate-50"
                }`;

                if (active) {
                  return (
                    <span
                      key={item.label}
                      aria-current="page"
                      className={itemClassName}
                    >
                      {navigationContent}
                    </span>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    prefetch={false}
                    onClick={onClose}
                    className={itemClassName}
                  >
                    {navigationContent}
                  </Link>
                );
              },
            )}
          </section>

          <section className="border-b border-[#e5edef] py-1">
            <DrawerRow
              label="Add brand"
              href={withSocialPreview(
                "/dashboard/social?addBrand=1",
                searchParams,
              )}
              icon={Plus}
              premiumLocked={premiumLocked}
              active={searchParams.get("addBrand") === "1"}
              onClose={onClose}
            />

            <DrawerRow
              label="Connections"
              href={withSocialPreview(
                "/dashboard/social/brands/settings?tab=connections",
                searchParams,
              )}
              icon={Share2}
              active={connectionsActive}
              onClose={onClose}
            />

            <DrawerRow
              label="AI Configuration"
              href={withSocialPreview(
                "/dashboard/social/brands/settings?tab=ai",
                searchParams,
              )}
              icon={Sparkles}
              active={aiConfigurationActive}
              onClose={onClose}
            />

            <DrawerRow
              label="Brand settings"
              href={withSocialPreview(
                "/dashboard/social/brands/settings",
                searchParams,
              )}
              icon={Settings2}
              active={brandSettingsActive}
              onClose={onClose}
            />
          </section>

          <section className="border-b border-[#e5edef] py-1">
            <DrawerRow
              label="User management"
              href={withSocialPreview(
                "/dashboard/team",
                searchParams,
              )}
              icon={ShieldCheck}
              premiumLocked={premiumLocked}
              active={pathname.startsWith("/dashboard/team")}
              onClose={onClose}
            />

            <DrawerRow
              label="Plans and billing"
              href={withSocialPreview(
                "/dashboard/social/settings?tab=billing",
                searchParams,
              )}
              icon={CreditCard}
              active={
                (pathname.startsWith("/dashboard/social/settings") ||
                  pathname.startsWith("/dashboard/profile")) &&
                settingsTab === "billing"
              }
              onClose={onClose}
            />

            <DrawerRow
              label="My tasks"
              href={withSocialPreview(
                "/dashboard/social/approvals",
                searchParams,
              )}
              icon={ClipboardList}
              premiumLocked={premiumLocked}
              active={pathname.startsWith("/dashboard/social/approvals")}
              onClose={onClose}
            />

            <LanguageFlyout />

            <DrawerRow
              label="Account settings"
              href={withSocialPreview(
                "/dashboard/social/settings",
                searchParams,
              )}
              icon={Settings2}
              active={
                (pathname.startsWith("/dashboard/social/settings") ||
                  pathname.startsWith("/dashboard/profile") ||
                  pathname === "/dashboard/settings") &&
                settingsTab !== "billing"
              }
              onClose={onClose}
            />
          </section>

          <section className="py-1">
            <DrawerRow
              label="Help center"
              href="/dashboard/support"
              icon={CircleHelp}
              active={pathname.startsWith("/dashboard/support")}
              onClose={onClose}
            />

            <DrawerRow
              label="What's new"
              href="/dashboard/notifications"
              icon={Megaphone}
              active={pathname.startsWith("/dashboard/notifications")}
              onClose={onClose}
            />

            <DrawerRow
              label="Affiliation program"
              href="/marketplace"
              icon={Handshake}
              active={pathname.startsWith("/marketplace")}
              onClose={onClose}
            />
          </section>
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-white px-4 pb-4 pt-3">
          <form
            action="/auth/signout"
            method="post"
          >
            <button
              type="submit"
              className="flex items-center gap-2.5 text-[14px] font-normal text-[#303030] transition hover:text-rose-600"
            >
              <LogOut
                className="h-5 w-5 text-red-500"
                strokeWidth={1.8}
              />

              Logout
            </button>
          </form>

          <p className="mt-5 text-[14px] font-medium text-[#7c8e98]">
            <Link href="/terms" className="hover:text-slate-700">
              Legal terms
            </Link>
          </p>
        </footer>
      </aside>
    </div>
  );
}

function SocialTopbar({
  data,
  onOpenMobile,
  hideSidebar,
}: {
  data: SocialShellData;
  onOpenMobile: () => void;
  hideSidebar: boolean;
}) {
  const pathname = usePathname();

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-[66px] items-center border-b-4 border-[#dfff32] bg-[#2a1728] px-3 shadow-sm sm:px-5">
        {hideSidebar ? null : (
          <button
            type="button"
            onClick={onOpenMobile}
            aria-label="Open Social Media menu"
            className="mr-1 rounded-lg p-2 text-white hover:bg-white/10 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Link
          href="/dashboard"
          title="Back to TAKATAK Dashboard"
          className="mr-5 flex h-full items-center px-2"
        >
          <TakatakMark />
        </Link>

        <nav className="hidden h-full min-w-0 items-center gap-1 overflow-x-auto lg:flex">
          {TOP_NAVIGATION.map(
            (item) => {
              const Icon = item.icon;

              const active =
                item.label === "Analytics"
                  ? isAnalyticsPath(pathname)
                  : pathname.startsWith(item.href);

              if (!item.enabled) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled
                    title={`${item.label} will be activated when its real backend is implemented.`}
                    className="flex h-11 cursor-not-allowed items-center gap-2 rounded-lg px-4 text-sm font-medium text-white/70"
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              }

              const itemClassName = `flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition ${
                active
                  ? "bg-[#746f73] text-white"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`;

              if (active) {
                return (
                  <span
                    key={item.label}
                    aria-current="page"
                    className={itemClassName}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  prefetch={false}
                  className={itemClassName}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            },
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {data.hasPaidPlan !==
          true ? (
            <Link
              href="/dashboard/social/settings?tab=billing"
              className="hidden h-10 items-center gap-2 rounded-lg bg-[#dfff32] px-4 text-sm font-semibold text-[#2a1728] transition hover:bg-[#d5f526] xl:flex"
            >
              <Gem className="h-4 w-4" />
              Upgrade your plan
            </Link>
          ) : null}

          <BrandSelector data={data} />

          <button
            type="button"
            onClick={() => {
              setDrawerOpen(true);
            }}
            aria-label="Open account menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition hover:bg-white/10"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      <ModuleDrawer
        open={drawerOpen}
        data={data}
        onClose={() => {
          setDrawerOpen(false);
        }}
      />
    </>
  );
}

function AccountAvatar({
  account,
}: {
  account: SocialShellAccount;
}) {
  const [broken, setBroken] = useState(false);
  const label =
    account.displayName ||
    account.handle ||
    platformLabel(account.platform);

  if (account.profileImageUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={account.profileImageUrl}
        alt=""
        title={label}
        referrerPolicy="no-referrer"
        className="h-7 w-7 shrink-0 rounded-full border border-slate-200 object-cover"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span
      title={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-600"
    >
      {brandInitials(label) || "•"}
    </span>
  );
}

function SidebarPlatformIcon({
  platform,
  active,
}: {
  platform: SocialPlatformKey;
  active: boolean;
}) {
  if (platform === "linkedin") {
    return (
      <span
        aria-hidden="true"
        className={`flex  shrink-0 items-center justify-center rounded-xs text-[11px] font-black leading-none ${
          active
            ? "text-white"
            : " text-[#0a66c2]"
        }`}
      >
        <FaLinkedin size={25}/>
      </span>
    );
  }

  return (
    <SocialPlatformIcon
      platform={platform}
      className="h-6 w-6 shrink-0"
      inverse={active}
    />
  );
}

function SocialSidebarContent({
  data,
  collapsed,
  onNavigate,
  onToggleCollapsed,
  mobile = false,
}: {
  data: SocialShellData;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();

  const searchParams =
    useSearchParams();

  const summaryActive =
    pathname === "/dashboard/social";

  const brandSettingsActive =
    pathname === "/dashboard/social/brands" ||
    pathname.startsWith("/dashboard/social/brands/");

  const starterPlatformSet =
    new Set(
      STARTER_PLATFORMS.map(
        (item) =>
          item.accountPlatform,
      ),
    );

  const extraAccounts =
    data.accounts.filter(
      (account) =>
        !starterPlatformSet.has(
          account.platform,
        ),
    );

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <Link
          href={withSocialPreview("/dashboard/social", searchParams)}
          onClick={onNavigate}
          title={
            collapsed
              ? "Summary"
              : undefined
          }
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
            summaryActive
              ? "bg-[#2a1728] text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <ClipboardList className="h-5 w-5 shrink-0" />

          {!collapsed ? (
            <span>Summary</span>
          ) : null}
        </Link>

        <div className="mt-2 space-y-1">
          {STARTER_PLATFORMS.map(
            (item) => {
              const account =
                pickConnectedPlatformAccount(
                  data.accounts,
                  item.accountPlatform,
                );

              const active =
                pathname === item.href ||
                pathname.startsWith(
                  `${item.href}/`,
                );

              const href = withSocialPreview(
                item.href,
                searchParams,
              );

              return (
                <Link
                  key={
                    item.accountPlatform
                  }
                  href={href}
                  onClick={onNavigate}
                  title={
                    collapsed
                      ? item.label
                      : undefined
                  }
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-[#2a1728] text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <SidebarPlatformIcon
                    platform={
                      item.platform
                    }
                    active={active}
                  />

                  {!collapsed ? (
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                    </span>
                  ) : null}

                  {!collapsed ? (
                    account ? (
                      <AccountAvatar
                        account={
                          account
                        }
                      />
                    ) : item.premium ? (
                      <span
                        title="Available with an upgraded plan"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dfff32] text-[#2a1728]"
                      >
                        <Gem className="h-4 w-4" />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                          active
                            ? "border-white/70 text-white"
                            : "border-slate-300 text-slate-400"
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                      </span>
                    )
                  ) : null}
                </Link>
              );
            },
          )}

          {extraAccounts.map(
            (account) => {
              const platform =
                normalizePlatform(
                  account.platform,
                );

              if (!platform) {
                return null;
              }

              const platformHref =
                platformPageHref(
                  account.platform,
                );

              const active =
                pathname === platformHref ||
                pathname.startsWith(`${platformHref}/`);

              return (
                <Link
                  key={`${platform}:${account.displayName ?? account.handle ?? "account"}`}
                  href={withSocialPreview(
                    platformHref,
                    searchParams,
                  )}
                  onClick={onNavigate}
                  title={
                    collapsed
                      ? platformLabel(
                          account.platform,
                        )
                      : undefined
                  }
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-[#2a1728] text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <SidebarPlatformIcon
                    platform={platform}
                    active={active}
                  />

                  {!collapsed ? (
                    <span className="min-w-0 flex-1 truncate">
                      {platformLabel(
                        account.platform,
                      )}
                    </span>
                  ) : null}

                  {!collapsed ? (
                    <AccountAvatar
                      account={account}
                    />
                  ) : null}
                </Link>
              );
            },
          )}
        </div>

        <Link
          href={withSocialPreview(
            "/dashboard/social?connections=open",
            searchParams,
          )}
          onClick={onNavigate}
          title={
            collapsed
              ? "More connections"
              : undefined
          }
          className={`mt-3 flex items-center justify-center gap-2 rounded-xl border border-slate-900 text-sm font-medium text-slate-900 transition hover:bg-slate-100 ${
            collapsed
              ? "h-11 w-11 px-0"
              : "px-3 py-2.5"
          }`}
        >
          <Plus className="h-5 w-5 shrink-0" />

          {!collapsed ? (
            <span>
              More connections
            </span>
          ) : null}
        </Link>
      </div>

      <div className="shrink-0 border-t border-slate-200 px-3 py-3">
        <button
          type="button"
          disabled
          title="Reporting will be enabled with its real backend."
          className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 opacity-70"
        >
          <BarChart3 className="h-5 w-5 shrink-0" />

          {!collapsed ? (
            <>
              <span>Reporting</span>

              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-700">
                New
              </span>
            </>
          ) : null}
        </button>

        <button
          type="button"
          disabled
          title="Reports will be enabled with its real backend."
          className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 opacity-70"
        >
          <FileBarChart2 className="h-5 w-5 shrink-0" />

          {!collapsed ? (
            <span>Reports</span>
          ) : null}
        </button>

        <button
          type="button"
          disabled
          title="Hashtag Tracker will be enabled with its provider backend."
          className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 opacity-70"
        >
          <Hash className="h-5 w-5 shrink-0" />

          {!collapsed ? (
            <span>
              Hashtag Tracker
            </span>
          ) : null}
        </button>

        <Link
          href={withSocialPreview(
            "/dashboard/social/brands/settings",
            searchParams,
          )}
          onClick={onNavigate}
          title={
            collapsed
              ? "Brand settings"
              : undefined
          }
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
            brandSettingsActive
              ? "bg-[#2a1728] text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Settings2 className="h-5 w-5 shrink-0" />

          {!collapsed ? (
            <span>
              Brand settings
            </span>
          ) : null}
        </Link>
      </div>

      <div className="shrink-0 border-t border-slate-200 px-3 py-3">
  {!mobile && onToggleCollapsed ? (
    <div className="space-y-2">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        title={collapsed ? "Back to TAKATAK" : undefined}
        className={`flex items-center rounded-xl py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 ${
          collapsed ? "justify-center px-0" : "gap-3 px-3"
        }`}
      >
        <ArrowLeft className="h-5 w-5 shrink-0" />

        {!collapsed ? <span>Back to TAKATAK</span> : null}
      </Link>

      <button
        type="button"
        onClick={onToggleCollapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-100"
      >
        {collapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </button>
    </div>
  ) : (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
    >
      <ArrowLeft className="h-5 w-5" />
      Back to TAKATAK
    </Link>
  )}
</div>
    </div>
  );
}

export function SocialWorkspaceShell({
  children,
  data,
}: SocialWorkspaceShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] =
    useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [addBrandOpen, setAddBrandOpen] = useState(false);
  const [oauthNotice, setOauthNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const searchParams =
  useSearchParams();

const previewMode =
  process.env.NODE_ENV !==
  "production"
    ? searchParams.get("preview")
    : null;

const effectiveData: SocialShellData =
  previewMode === "new"
    ? {
        ...data,
        hasPaidPlan: false,
      }
    : previewMode ===
        "subscribed"
      ? {
          ...data,
          hasPaidPlan: true,
        }
      : data;

  useEffect(() => {
    const frame =
      window.requestAnimationFrame(
        () => {
          setCollapsed(
            window.localStorage.getItem(
              "takatak_social_sidebar_collapsed",
            ) === "1",
          );
        },
      );

    return () => {
      window.cancelAnimationFrame(
        frame,
      );
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("addBrand") !== "1") {
      return;
    }
    setAddBrandOpen(true);
    // Do not history.replaceState — Next.js patches it and re-fetches the
    // dynamic RSC payload in a loop (ACTION_RESTORE / spawnDynamicRequests).
  }, [pathname]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("social_oauth");
    if (!outcome) {
      return;
    }

    if (outcome === "accepted") {
      setOauthNotice({
        tone: "success",
        message:
          "Facebook authorization succeeded. Your connection was updated.",
      });
    } else if (outcome === "failed") {
      setOauthNotice({
        tone: "error",
        message:
          "Facebook authorization failed. You can try connecting again.",
      });
    } else if (outcome === "cancelled") {
      setOauthNotice({
        tone: "error",
        message: "Facebook authorization was cancelled.",
      });
    }

    // Strip the param only when Next's history flag is present so the
    // patched replaceState does not dispatch ACTION_RESTORE.
    const state = window.history.state as { __NA?: boolean; _N?: boolean } | null;
    if (!state?.__NA && !state?._N) {
      return;
    }
    params.delete("social_oauth");
    const query = params.toString();
    window.history.replaceState(state, "", query ? `${pathname}?${query}` : pathname);
  }, [pathname]);

  const hideSidebar = isSocialSettingsPage(pathname);
  const isPlanningPage = pathname.startsWith("/dashboard/social/calendar");

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;

      window.localStorage.setItem(
        "takatak_social_sidebar_collapsed",
        next ? "1" : "0",
      );

      return next;
    });
  }

  return (
    <div
      className={`min-h-screen ${hideSidebar ? "bg-white" : "bg-[#eef1f3]"}`}
    >
      <SocialTopbar
        data={effectiveData}
        hideSidebar={hideSidebar}
        onOpenMobile={() => {
          setMobileOpen(true);
        }}
      />

      {hideSidebar ? null : (
        <aside
          className={`fixed bottom-0 left-0 top-[66px] z-30 hidden border-r border-slate-200 bg-white transition-[width] duration-200 lg:block ${
            collapsed ? "w-[74px]" : "w-[238px]"
          }`}
        >
          <SocialSidebarContent
            data={effectiveData}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        </aside>
      )}

      {!hideSidebar && mobileOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close Social Media menu"
            onClick={() => {
              setMobileOpen(false);
            }}
            className="absolute inset-0 bg-slate-950/50"
          />

          <aside className="absolute bottom-0 left-0 top-0 w-72 max-w-[88%] border-r border-slate-200 bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between bg-[#2a1728] px-4">
              <TakatakMark />

              <button
                type="button"
                aria-label="Close Social Media menu"
                onClick={() => {
                  setMobileOpen(false);
                }}
                className="rounded-lg p-2 text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="h-[calc(100%-4rem)]">
              <SocialSidebarContent
                data={data}
                collapsed={false}
                mobile
                onNavigate={() => {
                  setMobileOpen(false);
                }}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <main
        className={`pt-[66px] transition-[padding] duration-200 ${
          hideSidebar
            ? isPlanningPage
              ? "h-screen overflow-hidden bg-[#eaeeef]"
              : "min-h-screen bg-white"
            : `min-h-screen ${collapsed ? "lg:pl-[74px]" : "lg:pl-[238px]"}`
        }`}
      >
        {hideSidebar ? (
          <div
            className={
              isPlanningPage
                ? "flex h-full min-h-0 flex-col overflow-hidden"
                : "w-full"
            }
          >
            {oauthNotice ? (
              <div className="px-5 pt-4 sm:px-6">
                <div
                  className={`flex items-start justify-between gap-3 rounded-[12px] border px-4 py-3 text-sm ${
                    oauthNotice.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                  role="status"
                >
                  <p>{oauthNotice.message}</p>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setOauthNotice(null)}
                    className="rounded p-1 opacity-70 hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
            {isPlanningPage ? null : (
              <SocialBillingBanner
                banner={effectiveData.billingBanner ?? null}
                className="mx-6 mt-4"
              />
            )}
            {children}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            {oauthNotice ? (
              <div
                className={`mb-4 flex items-start justify-between gap-3 rounded-[12px] border px-4 py-3 text-sm ${
                  oauthNotice.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
                role="status"
              >
                <p>{oauthNotice.message}</p>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setOauthNotice(null)}
                  className="rounded p-1 opacity-70 hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <SocialBillingBanner banner={effectiveData.billingBanner ?? null} />
            {children}
          </div>
        )}
      </main>

      <SocialOnboardingModal />
      <AddBrandsModal
        open={addBrandOpen}
        brands={effectiveData.brands.map((brand) => ({
          id: brand.id,
          name: brand.name,
          status: brand.status,
          displayLabel: brand.displayLabel,
          displayImageUrl: brand.displayImageUrl,
          connectedPlatforms: brand.connectedPlatforms,
        }))}
        activeBrandId={effectiveData.activeBrandId}
        canAddBrand={
          Boolean(effectiveData.canManageBrands) &&
          effectiveData.brands.length <
            (effectiveData.brandAllowance ?? 1)
        }
        brandAllowance={effectiveData.brandAllowance ?? 1}
        hasPaidPlan={Boolean(effectiveData.hasPaidPlan)}
        billingHref={withSocialPreview(
          "/dashboard/billing",
          searchParams,
        )}
        usersHref={withSocialPreview("/dashboard/team", searchParams)}
        onClose={() => setAddBrandOpen(false)}
        onSelectBrand={(brandId) => {
          void fetch("/api/social/brand-context", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brandId }),
          }).then((response) => {
            if (response.ok) {
              window.location.reload();
            }
          });
        }}
        onCreated={() => {
          setAddBrandOpen(false);
          window.location.reload();
        }}
      />

      <ManageConnectionsModal
        key={
          data.activeBrandId ??
          "no-active-brand"
        }
        activeBrandId={
          data.activeBrandId
        }
        activeBrandName={
          data.activeBrandName
        }
        providers={
          data.providers
        }
        initialConnections={
          data.connections
        }
        canManage={
          data.canManageSocialAccounts
        }
      />
    </div>
  );
}