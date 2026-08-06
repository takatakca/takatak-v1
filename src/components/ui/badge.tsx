import type { ReactNode } from "react";

type BadgeTone =
  | "neutral"
  | "accent"
  | "warning"
  | "muted"
  | "success"
  | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral:
    "bg-slate-100 text-slate-600 ring-slate-200",
  accent:
    "bg-indigo-50 text-indigo-700 ring-indigo-200",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-200",
  muted:
    "bg-slate-50 text-slate-400 ring-slate-200",
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-200",
  danger:
    "bg-rose-50 text-rose-700 ring-rose-200",
};

export function toneForStatus(
  status: string,
): BadgeTone {
  switch (status) {
    case "connected":
    case "completed":
    case "active":
    case "primary":
      return "success";

    case "error":
    case "failed":
    case "expired":
    case "suspended":
      return "danger";

    case "pending_credentials":
    case "not_connected":
    case "paused":
      return "warning";

    case "planned":
    case "prospect":
      return "accent";

    case "disabled":
    case "archived":
      return "muted";

    default:
      return "neutral";
  }
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

// import type { ReactNode } from "react";

// type BadgeTone = "neutral" | "accent" | "warning" | "muted" | "success" | "danger";

// const TONES: Record<BadgeTone, string> = {
//   neutral: "bg-slate-100 text-slate-600 ring-slate-200",
//   accent: "bg-indigo-50 text-indigo-700 ring-indigo-200",
//   warning: "bg-amber-50 text-amber-700 ring-amber-200",
//   muted: "bg-slate-50 text-slate-400 ring-slate-200",
//   success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
//   danger: "bg-rose-50 text-rose-700 ring-rose-200",
// };

// /** Map honest status values to visual tones. Nothing renders green
//  *  unless the status is truly "connected"/"completed" (not used in Phase 1). */
// export function toneForStatus(status: string): BadgeTone {
//   switch (status) {
//     case "connected":
//     case "completed":
//       return "success";
//     case "error":
//     case "failed":
//     case "expired":
//       return "danger";
//     case "pending_credentials":
//     case "not_connected":
//       return "warning";
//     case "planned":
//       return "accent";
//     case "disabled":
//       return "muted";
//     default:
//       return "neutral";
//   }
// }

// export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
//   return (
//     <span
//       className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
//     >
//       {children}
//     </span>
//   );
// }
