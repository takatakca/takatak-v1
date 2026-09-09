"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QUICK_ACTIONS } from "@/lib/dashboard/dashboard-config";

export function QuickActionsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1f2125] px-4 py-2.5 text-sm font-medium text-white shadow-sm"
      >
        Quick Actions
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            const className =
              "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50";
            if (action.href && !action.comingSoon) {
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className={className}
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  {action.label}
                </Link>
              );
            }
            return (
              <div key={action.label} className={`${className} cursor-not-allowed opacity-60`}>
                <Icon className="h-4 w-4 text-slate-400" />
                <span className="flex-1">{action.label}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Soon
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
