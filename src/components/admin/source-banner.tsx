import { Database, FlaskConical, ShieldAlert } from "lucide-react";
import type { AdminDataSource } from "@/lib/admin/types";

export function AdminSourceBanner({ source, label }: { source: AdminDataSource; label: string }) {
  const Icon = source === "database" ? Database : source === "unavailable" ? ShieldAlert : FlaskConical;
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <Icon className="h-3 w-3" />
      {label}
    </p>
  );
}
