"use client";

import { Database, FlaskConical, ShieldAlert } from "lucide-react";
import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import { adminFr } from "@/lib/admin/admin-fr";
import type { AdminDataSource } from "@/lib/admin/types";

export function AdminSourceBanner({ source, label }: { source: AdminDataSource; label: string }) {
  const fr = useDashboardLanguage() === "fr";
  const Icon = source === "database" ? Database : source === "unavailable" ? ShieldAlert : FlaskConical;
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <Icon className="h-3 w-3" />
      {adminFr(label, fr)}
    </p>
  );
}
