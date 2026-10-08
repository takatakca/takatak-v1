"use client";

import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/lib/website/auth-context";
import { UPMIND_HOSTING_PLANS } from "@/lib/website/upmind-config";
import { useLanguage } from "@/lib/website/use-language";
import { submitWebsiteRequest } from "@/lib/website/website-requests";

/**
 * Shown when the Upmind hosting widgets cannot load: the visitor picks a plan
 * and TAKATAK receives it as a lead (confirmed and set up by the team; nothing
 * is charged here).
 */
export function HostingRequestFallback() {
  const { user, isAuthenticated } = useAuth();
  const { t, lang } = useLanguage();
  const [planName, setPlanName] = useState<string>(UPMIND_HOSTING_PLANS[1]?.name ?? UPMIND_HOSTING_PLANS[0].name);
  const [name, setName] = useState(user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isAuthenticated && !email.trim() && !phone.trim()) {
      setError(t("fallback.hosting.contactRequired"));
      return;
    }
    setStatus("submitting");
    const result = await submitWebsiteRequest({
      kind: "hosting_request",
      planName,
      name: name.trim() || undefined,
      email: email.trim() || user?.email || undefined,
      phone: phone.trim() || user?.phone || undefined,
      language: lang,
      sourcePage: typeof window !== "undefined" ? window.location.pathname : undefined,
      website,
    });
    if (result.status === "sent") {
      setReference(result.reference);
      setStatus("done");
      return;
    }
    setStatus("idle");
    setError(
      result.status === "invalid" && (result.fieldErrors.contact || result.fieldErrors.email || result.fieldErrors.phone)
        ? t("fallback.hosting.contactRequired")
        : t("fallback.hosting.error"),
    );
  };

  if (status === "done") {
    return (
      <div className="w-full rounded-2xl border border-primary/20 bg-primary/5 p-5 text-left sm:p-7" role="status">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={22} />
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t("fallback.hosting.received")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("fallback.hosting.receivedBody", { plan: planName })}</p>
            {reference && (
              <p className="mt-2 text-xs font-medium text-foreground">{t("fallback.domain.reference", { reference })}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--shadow-card)] sm:p-7">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <AlertTriangle size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">{t("fallback.hosting.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("fallback.hosting.body")}</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground sm:col-span-2" htmlFor="fallback-hosting-plan">
          {t("fallback.hosting.planLabel")}
          <select
            id="fallback-hosting-plan"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm font-normal outline-none focus:border-primary"
          >
            {UPMIND_HOSTING_PLANS.map((plan) => (
              <option key={plan.id} value={plan.name}>{plan.name}</option>
            ))}
          </select>
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={t("fallback.domain.nameLabel")}
          placeholder={t("fallback.domain.nameLabel")}
          className="rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary sm:col-span-2"
        />
        {!isAuthenticated && (
          <>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              aria-label={t("fallback.domain.emailLabel")}
              placeholder={t("fallback.domain.emailLabel")}
              className="rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              aria-label={t("fallback.domain.phoneLabel")}
              placeholder={t("fallback.domain.phoneLabel")}
              className="rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
            />
          </>
        )}
        {/* Hidden from people; bots that fill it are ignored by the server. */}
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
        {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
        <button
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2"
        >
          {status === "submitting" ? t("fallback.domain.sending") : t("fallback.hosting.submit")} <ArrowRight size={15} />
        </button>
      </form>
    </div>
  );
}
