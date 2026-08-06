import { TriangleAlert } from "lucide-react";

/** Phase 13 boundary made visible on admin pages. */
export function AdminBoundaryWarning() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <p className="text-xs leading-relaxed text-amber-800">
        Admin operations are view-only in Phase 13. Job execution/retry, role changes, user invitations,
        client disabling, webhook replay, provider repair, and notification sending are not active.
      </p>
    </div>
  );
}
