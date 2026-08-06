"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import { useState } from "react";
import {
  Bot,
  Briefcase,
  ChevronDown,
  Code2,
  Database,
  MapPin,
  Megaphone,
  Menu,
  Palette,
  PenLine,
  Search,
  TrendingUp,
  Video,
  X,
} from "lucide-react";

const primaryNav = [
  {
    href: "/marketplace",
    label: "Marketplace",
  },
  {
    href: "/domain",
    label: "Domains",
  },
  {
    href: "/hosting",
    label: "Hosting",
  },
  {
    href: "/services/local-listings",
    label: "QMAPS",
  },
  {
    href: "/services/lead-generation",
    label: "FLEXS",
  },
  {
    href: "/services/ai-business-tools",
    label: "AI Tools",
  },
] as const;

const moreNav = [
  {
    href: "/deals",
    label: "Today's Deals",
  },
  {
    href: "/services/websites",
    label: "Websites",
  },
  {
    href: "/services/mobile-apps",
    label: "Mobile Apps",
  },
  {
    href: "/services/voip",
    label: "VoIP",
  },
  {
    href: "/services/marketing",
    label: "Marketing",
  },
  {
    href: "/services/social-media",
    label: "Social Media",
  },
] as const;

const allNav = [
  ...primaryNav,
  ...moreNav,
];

const CATEGORY_BAR = [
  {
    icon: TrendingUp,
    label: "Trending",
    slug: "logo_design",
  },
  {
    icon: Palette,
    label: "Graphics & Design",
    slug: "logo_design",
  },
  {
    icon: Code2,
    label: "Programming & Tech",
    slug: "website_design",
  },
  {
    icon: Megaphone,
    label: "Digital Marketing",
    slug: "online_advertising",
  },
  {
    icon: PenLine,
    label: "Writing & Translation",
    slug: "content_writing",
  },
  {
    icon: Video,
    label: "Video & Animation",
    slug: "social_media_content",
  },
  {
    icon: Briefcase,
    label: "Business",
    slug: "virtual_assistance",
  },
  {
    icon: Bot,
    label: "AI Services",
    slug: "ai_tool_setup",
  },
  {
    icon: MapPin,
    label: "Local Visibility",
    slug: "seo_local_visibility",
  },
  {
    icon: Database,
    label: "Data",
    slug: "data_entry",
  },
] as const;

function isActiveRoute(
  pathname: string,
  href: string,
): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export function SiteHeader({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] =
    useState(false);

  const [moreOpen, setMoreOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  function submitSearch(): void {
    const normalizedQuery =
      query.trim();

    if (!normalizedQuery) {
      return;
    }

    router.push(
      `/marketplace/search?q=${encodeURIComponent(
        normalizedQuery,
      )}`,
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5"
          aria-label="TAKATAK home"
        >
          <span className="text-[22px] font-extrabold tracking-tight text-foreground">
            TAKATAK
          </span>

          <span
            className="mt-3 h-1.5 w-1.5 rounded-full bg-primary"
            aria-hidden="true"
          />
        </Link>

        <div className="hidden max-w-xl flex-1 md:flex">
          <div className="flex w-full items-stretch overflow-hidden rounded-md border border-border bg-card transition-colors focus-within:border-foreground/60">
            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitSearch();
                }
              }}
              placeholder="What service are you looking for today?"
              className="min-w-0 flex-1 bg-transparent px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="Search marketplace"
            />

            <button
              type="button"
              onClick={submitSearch}
              className="flex items-center justify-center bg-foreground px-3.5 text-background transition-opacity hover:opacity-90"
              aria-label="Search"
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        <ul className="ml-auto hidden items-center gap-0.5 text-[13px] font-medium lg:flex">
          {primaryNav.map((item) => {
            const active = isActiveRoute(
              pathname,
              item.href,
            );

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`whitespace-nowrap rounded-md px-2.5 py-2 transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-foreground/75 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}

          <li
            className="relative"
            onMouseEnter={() =>
              setMoreOpen(true)
            }
            onMouseLeave={() =>
              setMoreOpen(false)
            }
          >
            <button
              type="button"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-2 text-foreground/75 transition-colors hover:text-foreground"
              onClick={() =>
                setMoreOpen(
                  (current) => !current,
                )
              }
              aria-expanded={moreOpen}
            >
              More
              <ChevronDown size={13} />
            </button>

            {moreOpen ? (
            <div className="absolute right-0 top-full z-[100] w-56 pt-2">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-950 shadow-[0_24px_70px_-20px_rgba(15,23,42,0.45)]">
                {moreNav.map((item) => (
                    <Link
                    key={item.href}
                    href={item.href}
                    onClick={() =>
                        setMoreOpen(false)
                    }
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                    >
                    {item.label}
                    </Link>
                ))}
                </div>
            </div>
            ) : null}
          </li>
        </ul>

        <div className="ml-2 hidden shrink-0 items-center gap-1 lg:flex">
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium hover:bg-secondary"
              >
                Dashboard
              </Link>

              <form
                action="/auth/signout"
                method="post"
              >
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-[13px] font-medium hover:bg-secondary"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium text-foreground/80 hover:text-foreground"
              >
                Sign in
              </Link>

              <Link
                href="/register"
                className="whitespace-nowrap rounded-md bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            setOpen(
              (current) => !current,
            )
          }
          className="ml-auto rounded-md p-2 hover:bg-secondary lg:hidden"
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? (
            <X size={20} />
          ) : (
            <Menu size={20} />
          )}
        </button>
      </nav>

      <div className="hidden border-t border-border bg-background md:block">
        <div className="mx-auto max-w-7xl px-4">
          <ul className="flex gap-1 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_BAR.map(
              (category) => {
                const Icon =
                  category.icon;

                const href =
                  `/marketplace/category/${category.slug}`;

                const active =
                  pathname === href;

                return (
                  <li
                    key={category.label}
                    className="shrink-0"
                  >
                    <Link
                      href={href}
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors ${
                        active
                          ? "bg-secondary text-foreground ring-1 ring-primary"
                          : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon
                        size={13}
                        className="text-primary"
                      />

                      {category.label}
                    </Link>
                  </li>
                );
              },
            )}
          </ul>
        </div>
      </div>

      {open ? (
        <div className="space-y-1 border-t border-border bg-background px-4 py-3 lg:hidden">
          <div className="mb-2 border-b border-border pb-3">
            <div className="flex w-full items-stretch overflow-hidden rounded-md border border-border bg-card">
              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    setOpen(false);
                    submitSearch();
                  }
                }}
                placeholder="Search services…"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
              />

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  submitSearch();
                }}
                className="bg-foreground px-3 text-background"
                aria-label="Search"
              >
                <Search size={16} />
              </button>
            </div>
          </div>

          {allNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() =>
                setOpen(false)
              }
              className="block rounded-md px-3 py-2 text-sm hover:bg-secondary"
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-2 flex gap-2 border-t border-border pt-2">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() =>
                    setOpen(false)
                  }
                  className="flex-1 rounded-md border border-border px-3 py-2 text-center text-sm"
                >
                  Dashboard
                </Link>

                <form
                  action="/auth/signout"
                  method="post"
                  className="flex-1"
                >
                  <button
                    type="submit"
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() =>
                    setOpen(false)
                  }
                  className="flex-1 rounded-md border border-border px-3 py-2 text-center text-sm"
                >
                  Sign in
                </Link>

                <Link
                  href="/register"
                  onClick={() =>
                    setOpen(false)
                  }
                  className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground"
                >
                  Start
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}