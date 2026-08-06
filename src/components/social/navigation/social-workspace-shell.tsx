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
  Check,
  // ShieldCheck,
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

import {
  ManageConnectionsModal,
  type ManageConnectionsConnection,
  type ManageConnectionsProvider,
} from "@/components/social/connections/manage-connections-modal";
import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import { FaLinkedin } from "react-icons/fa";
import { SocialOnboardingModal } from "@/components/social/onboarding/social-onboarding-modal";
import { SocialPreviewSwitcher } from "@/components/social/preview/social-preview-switcher";

export interface SocialShellBrand {
  id: string;
  name: string;
  status: string;
}

export interface SocialShellAccount {
  id: string;
  platform: string;
  handle: string | null;
  displayName: string | null;
  status: string;
}

export interface SocialShellData {
  activeBrandId: string | null;
  activeBrandName: string | null;
  brands: SocialShellBrand[];
  accounts: SocialShellAccount[];
  providers: ManageConnectionsProvider[];
  connections: ManageConnectionsConnection[];
  canManageSocialAccounts: boolean;

  /*
   * Optional for now so the shell continues to work
   * before the billing data is passed by the layout.
   */
  planName?: string | null;
  hasPaidPlan?: boolean;

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
    enabled: false,
  },
  {
    label: "Inbox",
    href: "/dashboard/social/inbox",
    icon: Inbox,
    enabled: false,
  },
  {
    label: "Planning",
    href: "/dashboard/social/calendar",
    icon: CalendarDays,
    enabled: false,
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
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase() ?? "",
    )
    .join("");
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

function BrandSelector({
  data,
}: {
  data: SocialShellData;
}) {
  const router = useRouter();

  const [open, setOpen] =
    useState(false);

  const [isPending, startTransition] =
    useTransition();

  const [message, setMessage] =
    useState<string | null>(null);

  async function updateBrand(
    brandId: string,
  ) {
    setMessage(null);

    try {
      const response = await fetch(
        "/api/social/brand-context",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            brandId,
          }),
        },
      );

      const result = (await response
        .json()
        .catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setMessage(
          result?.message ??
            "The brand could not be changed.",
        );

        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setMessage(
        "The brand could not be changed.",
      );
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(
            (current) => !current,
          );
        }}
        aria-expanded={open}
        className={`flex h-11 min-w-48 items-center gap-2 rounded-xl border px-2.5 text-left transition ${
          open
            ? "border-white/30 bg-[#766f75]"
            : "border-white/10 bg-white/10 hover:bg-white/15"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600">
          {data.activeBrandName
            ? brandInitials(
                data.activeBrandName,
              )
            : "—"}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {data.activeBrandName ??
            "No active brand"}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-[52px] z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <Link
            href="/dashboard/brands"
            onClick={() => {
              setOpen(false);
            }}
            className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 text-base font-medium text-slate-900 transition hover:bg-[#f7fadf]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-900">
              <Plus className="h-5 w-5" />
            </span>

            Add brand
          </Link>

          <div className="max-h-72 overflow-y-auto py-2">
            {data.brands.map(
              (brand) => {
                const selected =
                  brand.id ===
                  data.activeBrandId;

                return (
                  <button
                    key={brand.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(
                        () => {
                          void updateBrand(
                            brand.id,
                          );
                        },
                      );
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition disabled:cursor-wait ${
                      selected
                        ? "bg-slate-200"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                      {brandInitials(
                        brand.name,
                      )}
                    </span>

                    <span className="truncate text-sm font-medium text-slate-900">
                      {brand.name}
                    </span>
                  </button>
                );
              },
            )}

            {data.brands.length ===
            0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">
                No brands are available
                in this workspace.
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

function DrawerRow({
  label,
  href,
  icon: Icon,
  premiumLocked = false,
  languageCode,
  showChevron = false,
  disabled = false,
  onClose,
}: {
  label: string;
  href?: string;
  icon: typeof Settings2;
  premiumLocked?: boolean;
  languageCode?: string;
  showChevron?: boolean;
  disabled?: boolean;
  onClose: () => void;
}) {
  const rowClassName = `flex min-h-[46px] w-full items-center gap-2.5 px-4 text-left text-[14px] font-normal transition-colors ${
    premiumLocked
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

  if (!open) {
    return null;
  }

  const premiumLocked =
    data.hasPaidPlan !== true;

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
                  item.label ===
                  "Analytics"
                    ? pathname ===
                        "/dashboard/social" ||
                      pathname.startsWith(
                        "/dashboard/social/",
                      )
                    : pathname.startsWith(
                        item.href,
                      );

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

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className={`flex min-h-[46px] w-full items-center gap-2.5 px-4 text-left text-[14px] font-medium transition ${
                      active
                        ? "bg-slate-200 text-slate-950"
                        : "text-[#2a2a2a] hover:bg-slate-50"
                    }`}
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
              href="/dashboard/brands"
              icon={Plus}
              premiumLocked={
                premiumLocked
              }
              onClose={onClose}
            />

            <DrawerRow
              label="Connections"
              href="/dashboard/social?connections=open"
              icon={Share2}
              onClose={onClose}
            />

            <DrawerRow
              label="Brand settings"
              href="/dashboard/brands"
              icon={Settings2}
              onClose={onClose}
            />
          </section>

          <section className="border-b border-[#e5edef] py-1">
            <DrawerRow
              label="User management"
              href="/dashboard/team"
              icon={ShieldCheck}
              premiumLocked={
                premiumLocked
              }
              onClose={onClose}
            />

            <DrawerRow
              label="Plans and billing"
              href="/dashboard/settings"
              icon={CreditCard}
              onClose={onClose}
            />

            <DrawerRow
              label="My tasks"
              href="/dashboard/social/approvals"
              icon={ClipboardList}
              premiumLocked={
                premiumLocked
              }
              onClose={onClose}
            />

            {/* <DrawerRow
              label="Language"
              icon={Globe2}
              languageCode="EN"
              showChevron
              onClose={onClose}
            /> */}
            <LanguageFlyout />

            <DrawerRow
              label="Account settings"
              href="/dashboard/settings"
              icon={Settings2}
              onClose={onClose}
            />
          </section>

          <section className="py-1">
            <DrawerRow
              label="Help center"
              icon={CircleHelp}
              disabled
              onClose={onClose}
            />

            <DrawerRow
              label="What's new"
              icon={Megaphone}
              disabled
              onClose={onClose}
            />

            <DrawerRow
              label="Affiliation program"
              icon={Handshake}
              disabled
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
            Legal terms
          </p>
        </footer>
      </aside>
    </div>
  );
}

function SocialTopbar({
  data,
  onOpenMobile,
}: {
  data: SocialShellData;
  onOpenMobile: () => void;
}) {
  const pathname = usePathname();

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-[66px] items-center border-b-4 border-[#dfff32] bg-[#2a1728] px-3 shadow-sm sm:px-5">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open Social Media menu"
          className="mr-1 rounded-lg p-2 text-white hover:bg-white/10 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

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
                item.label ===
                "Analytics"
                  ? pathname ===
                      "/dashboard/social" ||
                    pathname.startsWith(
                      "/dashboard/social/",
                    )
                  : pathname.startsWith(
                      item.href,
                    );

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

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition ${
                    active
                      ? "bg-[#746f73] text-white"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
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
              href="/dashboard/settings"
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
  const label =
    account.displayName ||
    account.handle ||
    platformLabel(account.platform);

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
          href="/dashboard/social"
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
                data.accounts.find(
                  (candidate) =>
                    candidate.platform ===
                    item.accountPlatform,
                ) ?? null;

              const active =
                pathname === item.href ||
                pathname.startsWith(
                  `${item.href}/`,
                );

              const href = account
                ? `${item.href}?accountId=${encodeURIComponent(
                    account.id,
                  )}`
                : item.href;

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
                pathname ===
                  platformHref &&
                searchParams.get(
                  "accountId",
                ) === account.id;

              return (
                <Link
                  key={account.id}
                  href={`${platformHref}?accountId=${encodeURIComponent(
                    account.id,
                  )}`}
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
          href="/dashboard/social?connections=open"
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
          href="/dashboard/brands"
          onClick={onNavigate}
          title={
            collapsed
              ? "Brand settings"
              : undefined
          }
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
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
        {!mobile &&
        onToggleCollapsed ? (
          <button
            type="button"
            onClick={
              onToggleCollapsed
            }
            title={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-100"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
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
  const [collapsed, setCollapsed] =
    useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);

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
    <div className="min-h-screen bg-[#eef1f3]">
      <SocialTopbar
        data={effectiveData}
        onOpenMobile={() => {
          setMobileOpen(true);
        }}
      />

      <aside
        className={`fixed bottom-0 left-0 top-[66px] z-30 hidden border-r border-slate-200 bg-white transition-[width] duration-200 lg:block ${
          collapsed
            ? "w-[74px]"
            : "w-[238px]"
        }`}
      >
        <SocialSidebarContent
          data={effectiveData}
          collapsed={collapsed}
          onToggleCollapsed={
            toggleCollapsed
          }
        />
      </aside>

      {mobileOpen ? (
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
        className={`min-h-screen pt-[66px] transition-[padding] duration-200 ${
          collapsed
            ? "lg:pl-[74px]"
            : "lg:pl-[238px]"
        }`}
      >
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <SocialOnboardingModal />
      <SocialPreviewSwitcher />

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