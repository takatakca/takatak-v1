"use client";

import { ChevronDown, Gem, Search, Tag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FaLinkedin } from "react-icons/fa";
import { useRouter } from "next/navigation";

import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import { RolesPremiumModal } from "@/components/team/roles-premium-modal";
import {
  ROLE_LABELS,
  type RoleKey,
} from "@/lib/security/roles";
import type {
  UserManagementCapabilities,
  WorkspaceBrandSummary,
  WorkspaceMemberSummary,
} from "@/lib/team/team-data";

const PLATFORM_KEYS: SocialPlatformKey[] = [
  "facebook",
  "instagram",
  "threads",
  "x",
  "linkedin",
  "pinterest",
  "tiktok",
  "youtube",
  "google_business",
  "twitch",
];

function platformKey(platform: string): SocialPlatformKey | null {
  const key = platform.trim().toLowerCase();
  return PLATFORM_KEYS.includes(key as SocialPlatformKey)
    ? (key as SocialPlatformKey)
    : null;
}

function PlatformMark({ platform }: { platform: string }) {
  if (platform === "linkedin") {
    return (
      <FaLinkedin aria-hidden="true" className="h-4 w-4" color="#0A66C2" />
    );
  }

  const key = platformKey(platform);
  if (!key) {
    return null;
  }

  return <SocialPlatformIcon platform={key} className="h-4 w-4" />;
}

function FilterSelect({
  label,
  displayValue,
  value,
  disabled,
  onChange,
  children,
}: {
  label: string;
  displayValue: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative w-full min-w-[140px] shrink-0 sm:w-40">
      <span className="sr-only">{label}</span>
      {disabled ? (
        <span
          aria-disabled="true"
          title={`${label} unlocks after you subscribe`}
          className="flex h-11 w-full cursor-not-allowed items-center justify-between rounded-full border border-slate-200 bg-[#f4f5f6] px-4 text-sm text-slate-400"
        >
          {displayValue}
          <ChevronDown className="h-4 w-4 text-slate-300" />
        </span>
      ) : (
        <>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 w-full appearance-none rounded-full border border-slate-300 bg-white py-2 pl-4 pr-10 text-sm text-slate-800 outline-none focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20"
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </>
      )}
    </label>
  );
}

export function MemberAccessModal({
  open,
  member,
  brands,
  teamUnlocked,
  capabilities,
  billingHref,
  onClose,
}: {
  open: boolean;
  member: WorkspaceMemberSummary | null;
  brands: WorkspaceBrandSummary[];
  teamUnlocked: boolean;
  capabilities: UserManagementCapabilities;
  billingHref: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const onCloseRef = useRef(onClose);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("any");
  const [brandFilter, setBrandFilter] = useState("any");
  const [roleFilter, setRoleFilter] = useState("any");
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  const rolesOpenRef = useRef(false);

  useLayoutEffect(() => {
    rolesOpenRef.current = rolesOpen;
    onCloseRef.current = onClose;
  }, [rolesOpen, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setStateFilter("any");
    setBrandFilter("any");
    setRoleFilter("any");
    setRolesOpen(false);
    setRoleMenuOpen(false);
  }, [open, member?.membershipId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !rolesOpenRef.current) {
        onCloseRef.current();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filteredBrands = useMemo(() => {
    if (!member) {
      return [];
    }

    if (stateFilter !== "any" && member.status !== stateFilter) {
      return [];
    }

    if (roleFilter !== "any" && member.role !== roleFilter) {
      return [];
    }

    const needle = query.trim().toLowerCase();

    return brands.filter((brand) => {
      if (brandFilter !== "any" && brand.id !== brandFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return brand.name.toLowerCase().includes(needle);
    });
  }, [brands, brandFilter, member, query, roleFilter, stateFilter]);

  async function assignRole(role: RoleKey) {
    if (!member || !teamUnlocked || !capabilities.canManageRoles) {
      return;
    }

    if (role === member.role) {
      setRoleMenuOpen(false);
      return;
    }

    setSavingRole(true);
    try {
      const response = await fetch(
        `/api/team/members/${encodeURIComponent(member.membershipId)}/role`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role }),
        },
      );

      if (response.ok) {
        setRoleMenuOpen(false);
        router.refresh();
      }
    } finally {
      setSavingRole(false);
    }
  }

  if (!open || !member) {
    return null;
  }

  const label = member.displayName?.trim() || member.email?.trim() || "User";
  const filtersLocked = !teamUnlocked;

  return (
    <>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-access-title"
      >
        <button
          type="button"
          aria-label="Close member access"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
        />

        <div className="relative z-10 flex max-h-[calc(100vh-32px)] w-full max-w-[980px] flex-col">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute -right-3 -top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1c1c] text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition hover:bg-black"
          >
            <X className="h-[15px] w-[15px]" strokeWidth={2.6} />
          </button>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <header className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2
                  id="member-access-title"
                  className="truncate text-[16px] font-semibold text-[#1d1d1f]"
                >
                  {member.email ?? label}
                </h2>
                <span className="mt-1 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                  {ROLE_LABELS[member.role]}
                </span>
              </div>
            </header>

            <div className="flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search brands</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  disabled={filtersLocked}
                  className="h-11 w-full rounded-full border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>
              <FilterSelect
                label="State"
                displayValue="States"
                value={stateFilter}
                disabled={filtersLocked}
                onChange={setStateFilter}
              >
                <option value="any">States</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </FilterSelect>
              <FilterSelect
                label="Brand"
                displayValue="Any brand"
                value={brandFilter}
                disabled={filtersLocked}
                onChange={setBrandFilter}
              >
                <option value="any">Any brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Role"
                displayValue="Any role"
                value={roleFilter}
                disabled={filtersLocked}
                onChange={setRoleFilter}
              >
                <option value="any">Any role</option>
                {(Object.keys(ROLE_LABELS) as RoleKey[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </FilterSelect>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <div className="grid grid-cols-[auto_minmax(0,1.1fr)_minmax(140px,0.8fr)_minmax(0,1.2fr)] items-center gap-3 border-b border-slate-100 px-1 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span className="w-10" />
                <p>Brand</p>
                <p>Role</p>
                <p>Connections</p>
              </div>

              {filteredBrands.length === 0 ? (
                <p className="px-1 py-10 text-center text-sm text-slate-500">
                  {brands.length === 0
                    ? "No brands in this workspace yet."
                    : "No brands match those filters."}
                </p>
              ) : (
                <ul>
                  {filteredBrands.map((brand) => (
                    <li
                      key={brand.id}
                      className="grid grid-cols-[auto_minmax(0,1.1fr)_minmax(140px,0.8fr)_minmax(0,1.2fr)] items-center gap-3 border-b border-slate-100 px-1 py-3 last:border-b-0"
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked
                        aria-label={`${brand.name} access`}
                        disabled
                        title={
                          teamUnlocked
                            ? "This member can access every brand in the workspace."
                            : "Upgrade to manage brand access."
                        }
                        className="relative h-5 w-9 shrink-0 rounded-full bg-[#3b82f6] opacity-80"
                      >
                        <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
                      </button>

                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400">
                          <Tag className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <span className="truncate text-sm font-medium text-[#1d1d1f]">
                          {brand.name}
                        </span>
                      </span>

                      <div className="relative">
                        <button
                          type="button"
                          disabled={savingRole}
                          onClick={() => {
                            if (!teamUnlocked) {
                              setRolesOpen(true);
                              return;
                            }
                            if (!capabilities.canManageRoles) {
                              return;
                            }
                            setRoleMenuOpen((current) => !current);
                          }}
                          className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-medium text-[#1d1d1f] transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          {ROLE_LABELS[member.role]}
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </button>
                        {roleMenuOpen && teamUnlocked ? (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                            {capabilities.allowedRoles.map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => void assignRole(role)}
                                className="flex w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                              >
                                {ROLE_LABELS[role]}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <span className="flex flex-wrap items-center gap-1.5">
                        {brand.connectedPlatforms.length === 0 ? (
                          <span className="text-xs text-slate-400">None</span>
                        ) : (
                          brand.connectedPlatforms.map((platform) => (
                            <PlatformMark key={platform} platform={platform} />
                          ))
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!teamUnlocked ? (
              <div className="flex justify-end border-t border-slate-100 px-6 py-4">
                <Link
                  href={billingHref}
                  onClick={onClose}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#f7fadf] px-4 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#f1f5d0]"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
                    <Gem className="h-2.5 w-2.5" />
                  </span>
                  Upgrade your plan
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <RolesPremiumModal
        open={rolesOpen}
        billingHref={billingHref}
        onClose={() => setRolesOpen(false)}
      />
    </>
  );
}
