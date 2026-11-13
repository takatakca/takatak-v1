"use client";

import {
  CAPABILITY_STATE_LABELS,
  TOKEN_HEALTH_LABELS,
  type ConnectionCapabilityProfile,
} from "@/lib/social/connections/capability-profile";

const STATE_CLASS: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  missing_scope: "bg-amber-50 text-amber-900 ring-amber-200",
  needs_reconnect: "bg-amber-50 text-amber-900 ring-amber-200",
  needs_app_review: "bg-sky-50 text-sky-900 ring-sky-200",
  blocked_cost: "bg-slate-100 text-slate-700 ring-slate-200",
  not_built: "bg-slate-50 text-slate-600 ring-slate-200",
  unsupported: "bg-slate-50 text-slate-500 ring-slate-200",
};

const HEALTH_CLASS: Record<string, string> = {
  healthy: "text-emerald-700",
  expiring_soon: "text-amber-700",
  expired: "text-rose-700",
  missing: "text-slate-500",
  error: "text-rose-700",
};

/** Honest per-connection capability strip: what works, what is missing, what to do. */
export function ConnectionCapabilities({
  profile,
  lang = "en",
}: {
  profile: ConnectionCapabilityProfile;
  lang?: "en" | "fr";
}) {
  if (!profile.capabilities.length) return null;
  return (
    <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2" aria-label={lang === "fr" ? "Capacités de la connexion" : "Connection capabilities"}>
      <p className={`text-[11px] font-medium ${HEALTH_CLASS[profile.tokenHealth] ?? "text-slate-500"}`}>
        {TOKEN_HEALTH_LABELS[profile.tokenHealth][lang]}
        {profile.tokenExpiresAt ? ` · ${profile.tokenExpiresAt.slice(0, 10)}` : ""}
        {" · "}
        <span className="text-slate-600">{profile.summary[lang]}</span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {profile.capabilities.map((capability) => (
          <li key={capability.key} className="group relative">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATE_CLASS[capability.state] ?? STATE_CLASS.not_built}`}
              title={capability.detail[lang]}
            >
              {capability.label[lang]}
              <span className="opacity-70">· {CAPABILITY_STATE_LABELS[capability.state][lang]}</span>
            </span>
          </li>
        ))}
      </ul>
      {profile.capabilities.some((capability) => capability.state !== "available" && capability.state !== "unsupported") ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600">
          {profile.capabilities
            .filter((capability) => capability.state !== "available" && capability.state !== "unsupported")
            .map((capability) => (
              <li key={`${capability.key}-detail`}>
                <span className="font-medium text-slate-700">{capability.label[lang]}:</span> {capability.detail[lang]}
                {capability.missingScopes.length ? (
                  <span className="text-slate-400"> ({capability.missingScopes.join(", ")})</span>
                ) : null}
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}
