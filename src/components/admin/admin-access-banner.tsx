import {
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { ADMIN_ROLE_LABELS } from "@/lib/admin/status";

export function AdminAccessBanner({
  enforced,
  role,
}: {
  enforced: boolean;
  role: string | null;
}) {
  if (enforced && role) {
    return (
      <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

        <p className="text-xs leading-relaxed text-emerald-800">
          Role enforcement active — signed in with role{" "}
          <strong>
            {ADMIN_ROLE_LABELS[role] ?? role}
          </strong>
          . Accounts without platform administration access are redirected before this page renders.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />

      <p className="text-xs leading-relaxed text-amber-800">
        Foundation mode — Supabase authentication is not configured, so no real platform role check ran for this render. Once authentication is configured, only platform administrators can load this page.
      </p>
    </div>
  );
}