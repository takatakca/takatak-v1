"use client";

import { Check, Gem, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef } from "react";

const PRIMARY_FEATURES = [
  "Owner, admin, manager, editor, staff, or viewer.",
  "Manage permissions by role: section viewing, editing, data management, and more.",
];

const ADVANCED_FEATURES = [
  "Full X analytics",
  "Access for your team, custom user roles, and a post-approval system",
  "Downloadable reports of your analytics in PDF format",
];

function GemCircle({ size = "md" }: { size?: "sm" | "md" }) {
  const wrap = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  const icon = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f] ${wrap}`}
    >
      <Gem className={icon} />
    </span>
  );
}

function FeatureRow({ item }: { item: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-5 text-[#4b4b4b]">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#3b82f6]">
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      </span>
      {item}
    </li>
  );
}

export function RolesPremiumModal({
  open,
  billingHref,
  onClose,
}: {
  open: boolean;
  billingHref: string;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roles-premium-title"
    >
      <button
        type="button"
        aria-label="Close roles upgrade"
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
            <div className="flex min-h-[520px] flex-col px-10 py-8 sm:px-12">
              <div className="flex items-center gap-2.5">
                <GemCircle />
                <h2
                  id="roles-premium-title"
                  className="text-[22px] font-bold tracking-tight text-[#1d1d1f]"
                >
                  Roles and permissions
                </h2>
              </div>

              <h3 className="mt-6 max-w-[380px] text-[18px] font-semibold leading-7 text-[#1d1d1f]">
                Divide and conquer: assign roles to your team members.
              </h3>
              <p className="mt-3 max-w-[380px] text-[15px] leading-6 text-[#5b5b5b]">
                Create a role for each job on the team. Agencies that manage
                several brands can give each person only the sections they need
                in TAKATAK.
              </p>

              <ul className="mt-6 max-w-[400px] space-y-2.5">
                {PRIMARY_FEATURES.map((item) => (
                  <FeatureRow key={item} item={item} />
                ))}
              </ul>

              <p className="mt-8 max-w-[400px] text-[15px] font-medium text-[#1d1d1f]">
                With an Advanced or higher plan, you also get:
              </p>
              <ul className="mt-3 max-w-[400px] space-y-2.5">
                {ADVANCED_FEATURES.map((item) => (
                  <FeatureRow key={item} item={item} />
                ))}
              </ul>

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
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
                  <GemCircle size="sm" />
                  Upgrade plan
                </Link>
              </div>
            </div>

            <div className="relative flex items-center justify-center overflow-hidden bg-[#e8e4f6] px-8 py-10">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c9b7f5] blur-[48px]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#ddd6f5]/80 via-[#e4eaf8]/50 to-[#d7e6f7]/90" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/rolesmodal_premium.png"
                alt=""
                className="relative z-10 w-full max-w-[320px] drop-shadow-[0_18px_40px_rgba(88,70,160,0.28)]"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
