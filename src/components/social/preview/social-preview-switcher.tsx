"use client";

import {
  Eye,
  Gem,
  RotateCcw,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

type PreviewMode =
  | "real"
  | "new"
  | "subscribed"
  | "onboarding";

const OPTIONS: Array<{
  value: PreviewMode;
  label: string;
  icon: LucideIcon;
}> = [
  {
    value: "real",
    label: "Real",
    icon: RotateCcw,
  },
  {
    value: "new",
    label: "New user",
    icon: UserRound,
  },
  {
    value: "subscribed",
    label: "Subscribed",
    icon: Gem,
  },
  {
    value: "onboarding",
    label: "Onboarding",
    icon: Sparkles,
  },
];

export function SocialPreviewSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams =
    useSearchParams();

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return null;
  }

  const rawPreview =
    searchParams.get("preview");

  const currentMode: PreviewMode =
    rawPreview === "new" ||
    rawPreview === "subscribed" ||
    rawPreview === "onboarding"
      ? rawPreview
      : "real";

  function selectMode(
    mode: PreviewMode,
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString(),
      );

    params.delete("connections");

    if (mode === "real") {
      params.delete("preview");
    } else {
      params.set("preview", mode);
    }

    const query = params.toString();

    router.replace(
      `${pathname}${
        query ? `?${query}` : ""
      }`,
      {
        scroll: false,
      },
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[85]">
      <div className="flex items-center gap-1 rounded-2xl border border-slate-300 bg-white p-1.5 shadow-[0_16px_45px_rgba(15,23,42,0.22)]">
        <span
          title="Social preview mode"
          className="flex h-9 w-9 items-center justify-center text-slate-400"
        >
          <Eye className="h-4 w-4" />
        </span>

        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected =
            option.value ===
            currentMode;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                selectMode(
                  option.value,
                );
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
                selected
                  ? "bg-[#2a1728] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />

              <span className="hidden sm:inline">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}