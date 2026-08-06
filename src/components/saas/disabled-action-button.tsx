import type { LucideIcon } from "lucide-react";

/** An honest disabled action: shows the future action and why it is inactive. */
export function DisabledActionButton({
  label,
  reason,
  icon: Icon,
}: {
  label: string;
  reason: string;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      disabled
      title={reason}
      className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-400 ring-1 ring-inset ring-slate-200"
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {label}
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {reason}
      </span>
    </button>
  );
}
