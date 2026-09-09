"use client";

import { ChevronDown, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { FaLinkedin } from "react-icons/fa";

import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import {
  toAiInstructionPlatform,
  type AiInstructionPlatform,
} from "@/lib/brands/brand-ai-instructions";
import type { BrandSettingsVoice } from "@/lib/brands/brand-settings-data";

const PLATFORM_ORDER: AiInstructionPlatform[] = [
  "bluesky",
  "facebook",
  "instagram",
  "google_business",
  "pinterest",
  "tiktok",
  "youtube",
  "threads",
  "x",
  "linkedin",
];

const PLATFORM_LABELS: Record<AiInstructionPlatform, string> = {
  bluesky: "Bluesky",
  facebook: "Facebook",
  instagram: "Instagram",
  google_business: "Google Business Profile",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
  x: "X",
  linkedin: "LinkedIn",
};

function PlatformGlyph({ platform }: { platform: AiInstructionPlatform }) {
  const className = "h-5 w-5 shrink-0";

  if (platform === "linkedin") {
    return (
      <FaLinkedin aria-hidden="true" className={className} color="#0A66C2" />
    );
  }

  return (
    <SocialPlatformIcon
      platform={platform as SocialPlatformKey}
      className={className}
    />
  );
}

function AccordionRow({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        aria-label={title || "General instructions"}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex h-7 w-7 items-center justify-center text-slate-500">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-slate-900">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {children}
        </div>
      ) : null}
    </article>
  );
}

export function BrandSettingsAi({
  brandId,
  voices,
  connectedPlatforms,
  canManage,
}: {
  brandId: string;
  voices: BrandSettingsVoice[];
  connectedPlatforms: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const voice = voices[0] ?? null;

  const platforms = useMemo(() => {
    const unique = [
      ...new Set(
        connectedPlatforms
          .map(toAiInstructionPlatform)
          .filter((platform): platform is AiInstructionPlatform =>
            Boolean(platform),
          ),
      ),
    ];

    return PLATFORM_ORDER.filter((platform) => unique.includes(platform));
  }, [connectedPlatforms]);

  const [generalOpen, setGeneralOpen] = useState(false);
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);
  const [general, setGeneral] = useState(voice?.generalInstructions ?? "");
  const [platformText, setPlatformText] = useState<Record<string, string>>(
    voice?.platformInstructions ?? {},
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || loading) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setSuccess(false);

    const platformsPayload: Record<string, string> = {};
    for (const platform of platforms) {
      platformsPayload[platform] = platformText[platform] ?? "";
    }

    try {
      const response = await fetch(
        `/api/brands/${encodeURIComponent(brandId)}/ai-instructions`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            general,
            platforms: platformsPayload,
          }),
        },
      );

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "AI instructions could not be saved.");
        return;
      }

      setSuccess(true);
      setMessage(result.message ?? "AI instructions were saved.");
      router.refresh();
    } catch {
      setMessage("A network error occurred. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8" noValidate>
      <h2 className="text-lg font-semibold text-[#1d1d1f]">
        Instructions configuration
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        Define the writing style for your messages. The AI assistant will use
        it as a guide when creating your posts. Tip: Writing your instructions
        in English usually leads to more accurate results.
      </p>

      {message ? (
        <p
          className={`mt-5 rounded-lg px-4 py-3 text-sm ${
            success
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="mt-5">
        <AccordionRow
          title=""
          icon={<Pencil className="h-4 w-4" strokeWidth={1.8} />}
          open={generalOpen}
          onToggle={() => setGeneralOpen((current) => !current)}
        >
          <label className="block text-sm text-slate-600">
            General instructions
            <textarea
              value={general}
              onChange={(event) => setGeneral(event.target.value)}
              disabled={!canManage}
              rows={7}
              maxLength={8000}
              placeholder="Describe the brand voice, tone, and rules the assistant should follow for every platform."
              className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20 disabled:bg-slate-50"
            />
          </label>
        </AccordionRow>
      </div>

      {platforms.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-sm text-slate-500">
          Connect a social account to add platform-specific instructions.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-10">
          {platforms.map((platform) => {
            const open = openPlatform === platform;
            return (
              <AccordionRow
                key={platform}
                title={PLATFORM_LABELS[platform]}
                icon={<PlatformGlyph platform={platform} />}
                open={open}
                onToggle={() =>
                  setOpenPlatform((current) =>
                    current === platform ? null : platform,
                  )
                }
              >
                <label className="block text-sm text-slate-600">
                  {PLATFORM_LABELS[platform]} instructions
                  <textarea
                    value={platformText[platform] ?? ""}
                    onChange={(event) =>
                      setPlatformText((current) => ({
                        ...current,
                        [platform]: event.target.value,
                      }))
                    }
                    disabled={!canManage}
                    rows={6}
                    maxLength={4000}
                    placeholder={`Optional extra guidance for ${PLATFORM_LABELS[platform]} posts.`}
                    className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20 disabled:bg-slate-50"
                  />
                </label>
              </AccordionRow>
            );
          })}
        </div>
      )}

      {canManage ? (
        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 min-w-[148px] items-center justify-center rounded-md bg-[#2a1728] px-5 text-sm font-semibold text-white transition hover:bg-[#3b2438] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          You can view these instructions, but you need permission to change
          them.
        </p>
      )}
    </form>
  );
}
