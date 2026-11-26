"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";

// "Add to dashboard": pins a network table to the Social summary. The pin is
// the section's name and its link, kept in this browser (no account data).

const STORAGE_KEY = "takatak.social.pins.v1";
const CHANGE_EVENT = "takatak:social-pins";
const MAX_PINS = 24;

export type SocialPin = { href: string; label: string; at: string };

function readPins(): SocialPin[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((pin): pin is SocialPin => Boolean(pin) && typeof pin.href === "string" && pin.href.startsWith("/dashboard/") && typeof pin.label === "string")
      .slice(0, MAX_PINS);
  } catch {
    return [];
  }
}

function writePins(pins: SocialPin[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pins.slice(0, MAX_PINS)));
  } catch {
    /* storage may be unavailable */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function usePins(): SocialPin[] {
  const [pins, setPins] = useState<SocialPin[]>([]);
  useEffect(() => {
    const sync = () => setPins(readPins());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return pins;
}

/** Where the button sits: this page plus the nearest section, named after its heading. */
function pinFromButton(button: HTMLElement): SocialPin {
  const section = button.closest("section[id]");
  const heading = (button.closest("section")?.querySelector("h1, h2")?.textContent ?? "").trim();
  const network = window.location.pathname.split("/").filter(Boolean).at(-1) ?? "social";
  const name = network.charAt(0).toUpperCase() + network.slice(1);
  return {
    href: `${window.location.pathname}${section ? `#${section.id}` : ""}`,
    label: `${name} · ${heading || document.title}`.slice(0, 120),
    at: new Date().toISOString(),
  };
}

export function PinToDashboardButton({ className, icon, badge }: { className?: string; icon?: ReactNode; badge?: ReactNode }) {
  const fr = useDashboardLanguage() === "fr";
  const pins = usePins();
  const [href, setHref] = useState<string | null>(null);
  const pinned = href !== null && pins.some((pin) => pin.href === href);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const pin = pinFromButton(event.currentTarget);
    setHref(pin.href);
    const current = readPins();
    writePins(current.some((item) => item.href === pin.href) ? current.filter((item) => item.href !== pin.href) : [pin, ...current]);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={pinned}
      title={fr ? "Épingler cette section au résumé Social" : "Pin this section to the Social summary"}
      className={className ?? "inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"}
    >
      {icon}
      {pinned ? (fr ? "Épinglé au tableau de bord ✓" : "Pinned to dashboard ✓") : fr ? "Ajouter au tableau de bord" : "Add to dashboard"}
      {badge}
    </button>
  );
}

/** The pinned sections, on the Social summary. */
export function PinnedSocialSections() {
  const fr = useDashboardLanguage() === "fr";
  const pins = usePins();
  if (!pins.length) return null;
  return (
    <section className="rounded-xl border border-[#e8eaed] bg-white px-5 py-4">
      <h2 className="text-sm font-semibold text-[#2a2a2a]">{fr ? "Épinglés" : "Pinned"}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {pins.map((pin) => (
          <li key={pin.href} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 pl-3 pr-1 text-xs">
            <Link href={pin.href} className="py-1.5 font-medium text-slate-800 hover:underline">
              {pin.label}
            </Link>
            <button
              type="button"
              onClick={() => writePins(readPins().filter((item) => item.href !== pin.href))}
              aria-label={fr ? `Retirer ${pin.label}` : `Unpin ${pin.label}`}
              className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
