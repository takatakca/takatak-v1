"use client";

import { Eye, EyeOff, Gem, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { ConfirmationDialog } from "@/components/team/confirmation-dialog";
import { AccountApiView } from "@/components/account/account-api-view";
import { AccountIntegrationsView } from "@/components/account/account-integrations-view";
import { PlansBillingView } from "@/components/account/plans-billing-view";
import type { AccountIntegrationsPageData } from "@/lib/account/account-integrations-data";
import type {
  AccountSettingsPageData,
  AccountSettingsTab,
} from "@/lib/account/account-settings-data";
import type { PlansBillingPageData } from "@/lib/billing/social/billing-page-data";
import type { AccountAccessFieldErrors } from "@/lib/account/account-access-validation";
import {
  ACCOUNT_LANGUAGES,
  WEEK_STARTS,
  type AccountSettingsFieldErrors,
} from "@/lib/account/account-settings-validation";

const TIMEZONES = [
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/St_Johns",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Australia/Sydney",
];

function initialsFor(data: Extract<AccountSettingsPageData, { source: "database" }>) {
  const first = data.firstName.trim().charAt(0);
  const last = data.lastName.trim().charAt(0);
  const fromName = `${first}${last}`.toUpperCase();
  if (fromName) {
    return fromName;
  }
  if (data.displayName?.trim()) {
    return data.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  }
  return data.email.slice(0, 2).toUpperCase();
}

function PremiumMark() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#dfff32] text-[#1d1d1f]">
      <Gem className="h-2.5 w-2.5" />
    </span>
  );
}

const inputClassName =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20 disabled:bg-slate-50";

export function AccountSettingsView({
  data,
  tab,
  basePath,
  billingData,
  canManageBilling,
  integrationsData,
}: {
  data: AccountSettingsPageData;
  tab: AccountSettingsTab;
  basePath: string;
  billingData: PlansBillingPageData;
  canManageBilling: boolean;
  integrationsData: AccountIntegrationsPageData;
}) {
  const searchParams = useSearchParams();

  function tabHref(next: AccountSettingsTab) {
    const path = next === "account" ? basePath : `${basePath}?tab=${next}`;
    return withSocialPreview(path, searchParams);
  }

  if (data.source === "unavailable") {
    return (
      <section className="px-5 py-10 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">{data.message}</p>
      </section>
    );
  }

  return (
    <div className="bg-white pb-16">
      <div className="bg-[#f5fafd] px-5 pt-5 sm:px-6">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">
          Settings
        </h1>

        <nav
          className="mt-5 flex flex-wrap gap-7 border-b border-slate-300"
          aria-label="Account settings"
        >
          {(
            [
              ["account", "Account"],
              ["access", "Access"],
              ["billing", "Plans and billing"],
              ["integrations", "Integrations"],
              ["api", "API"],
            ] as const
          ).map(([id, label]) => {
            const active = tab === id;
            return (
              <Link
                key={id}
                href={tabHref(id)}
                className={`inline-flex items-center gap-2 border-b-2 pb-3 text-[15px] transition ${
                  active
                    ? "border-[#1d1d1f] font-semibold text-[#1d1d1f]"
                    : "border-transparent font-medium text-slate-500 hover:text-slate-800"
                }`}
              >
                {id === "api" && !data.apiAccess ? <PremiumMark /> : null}
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-5 sm:px-6">
        {tab === "access" ? (
          <AccessPanel data={data} />
        ) : tab === "billing" ? (
          <PlansBillingView data={billingData} canManage={canManageBilling} />
        ) : tab === "integrations" ? (
          <AccountIntegrationsView data={integrationsData} />
        ) : tab === "api" ? (
          <AccountApiView
            apiAccess={data.apiAccess}
            planName={data.planName}
            billingHref={tabHref("billing")}
            connectedPlatforms={
              integrationsData.source === "database"
                ? integrationsData.connectedPlatforms
                : []
            }
          />
        ) : (
          <AccountPanel data={data} />
        )}
      </div>
    </div>
  );
}

function AccountPanel({
  data,
}: {
  data: Extract<AccountSettingsPageData, { source: "database" }>;
}) {
  const router = useRouter();
  const initials = initialsFor(data);
  const timezones = useMemo(() => {
    if (TIMEZONES.includes(data.timezone)) {
      return TIMEZONES;
    }
    return [data.timezone, ...TIMEZONES];
  }, [data.timezone]);

  const [firstName, setFirstName] = useState(data.firstName);
  const [lastName, setLastName] = useState(data.lastName);
  const [language, setLanguage] = useState(data.language);
  const [timezone, setTimezone] = useState(data.timezone);
  const [weekStartsOn, setWeekStartsOn] = useState(data.weekStartsOn);
  const [monthlySummaryEnabled, setMonthlySummaryEnabled] = useState(
    data.monthlySummaryEnabled,
  );
  const [monthlySummaryEmail, setMonthlySummaryEmail] = useState(
    data.monthlySummaryEmail,
  );
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AccountSettingsFieldErrors>(
    {},
  );

  const dirty =
    firstName !== data.firstName ||
    lastName !== data.lastName ||
    language !== data.language ||
    timezone !== data.timezone ||
    weekStartsOn !== data.weekStartsOn ||
    monthlySummaryEnabled !== data.monthlySummaryEnabled ||
    monthlySummaryEmail !== data.monthlySummaryEmail;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !dirty) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setSuccess(false);
    setFieldErrors({});

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          language,
          timezone,
          weekStartsOn,
          monthlySummaryEnabled,
          monthlySummaryEmail,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        fieldErrors?: AccountSettingsFieldErrors;
      };

      if (!response.ok || !result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? "Account settings could not be saved.");
        return;
      }

      setSuccess(true);
      setMessage(result.message ?? "Your account settings were saved.");
      router.refresh();
    } catch {
      setMessage("A network error occurred. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount() {
    if (deleting) {
      return;
    }

    setDeleting(true);
    setMessage(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        setConfirmDelete(false);
        setMessage(result.message ?? "Your account could not be deleted.");
        return;
      }

      await fetch("/auth/signout", { method: "POST", credentials: "same-origin" });
      window.location.href = "/login";
    } catch {
      setConfirmDelete(false);
      setMessage("A network error occurred. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
      {message ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            success
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-lg font-semibold text-slate-600">
            {initials}
          </span>
          <div>
            <button
              type="button"
              disabled
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-500"
            >
              Upload image
            </button>
            <p className="mt-2 text-sm text-slate-500">
              JPG or PNG. Image storage is not connected yet, so your initials
              are shown instead.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-600">
            First name
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              maxLength={50}
              className={inputClassName}
            />
            {fieldErrors.firstName ? (
              <span className="mt-1 block text-xs text-rose-600">
                {fieldErrors.firstName}
              </span>
            ) : null}
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Last name
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              maxLength={50}
              className={inputClassName}
            />
            {fieldErrors.lastName ? (
              <span className="mt-1 block text-xs text-rose-600">
                {fieldErrors.lastName}
              </span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-[#1d1d1f]">Preferences</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-600">
            Language *
            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as (typeof ACCOUNT_LANGUAGES)[number])
              }
              className={inputClassName}
            >
              <option value="en">English</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Timezone *
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className={inputClassName}
            >
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            {fieldErrors.timezone ? (
              <span className="mt-1 block text-xs text-rose-600">
                {fieldErrors.timezone}
              </span>
            ) : null}
          </label>
        </div>
        <label className="mt-5 block max-w-md text-sm font-medium text-slate-600">
          First day of the week
          <select
            value={weekStartsOn}
            onChange={(event) =>
              setWeekStartsOn(event.target.value as (typeof WEEK_STARTS)[number])
            }
            className={inputClassName}
          >
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
          </select>
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-[#1d1d1f]">
          Monthly summary
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={monthlySummaryEnabled}
          onClick={() => setMonthlySummaryEnabled((current) => !current)}
          className="mt-5 flex items-center gap-3 text-sm font-medium text-slate-700"
        >
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              monthlySummaryEnabled ? "bg-[#5b4b8a]" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                monthlySummaryEnabled ? "left-5" : "left-0.5"
              }`}
            />
          </span>
          Receive monthly summary
        </button>
        <label className="mt-5 block text-sm font-medium text-slate-600">
          Custom e-mail for the monthly summary
          <input
            type="email"
            value={monthlySummaryEmail}
            onChange={(event) => setMonthlySummaryEmail(event.target.value)}
            disabled={!monthlySummaryEnabled}
            className={inputClassName}
          />
        </label>
        <p className="mt-2 text-sm text-slate-500">
          When this field is empty the monthly summary is addressed to{" "}
          {data.email}. Delivery is saved as a preference; monthly emails are
          not sent yet.
        </p>
        {fieldErrors.monthlySummaryEmail ? (
          <p className="mt-1 text-xs text-rose-600">
            {fieldErrors.monthlySummaryEmail}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading || !dirty}
            className="inline-flex h-11 min-w-[148px] items-center justify-center rounded-md bg-[#2a1728] px-5 text-sm font-semibold text-white transition hover:bg-[#3b2438] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
        <p className="text-sm leading-6 text-rose-900">
          If you delete your TAKATAK account permanently, you will lose your
          current plan and the analytics data of your brands will be deleted.
          Make sure to cancel your subscription first if you have one, otherwise
          you may still be charged.
          {data.ownedWorkspaceNames.length > 0
            ? ` You currently own: ${data.ownedWorkspaceNames.join(", ")}. Transfer ownership before deleting.`
            : ""}
        </p>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mt-4 inline-flex h-10 items-center rounded-md border border-rose-400 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          Delete account
        </button>
      </section>

      <ConfirmationDialog
        open={confirmDelete}
        title="Delete your account?"
        description="This permanently disables your TAKATAK login. Workspace ownership must be transferred first. This cannot be undone."
        loading={deleting}
        proceedLabel="Delete account"
        onCancel={() => {
          if (!deleting) {
            setConfirmDelete(false);
          }
        }}
        onProceed={() => {
          void deleteAccount();
        }}
      />
    </form>
  );
}

function AccessPanel({
  data,
}: {
  data: Extract<AccountSettingsPageData, { source: "database" }>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(data.email);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AccountAccessFieldErrors>({});
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  const dirty =
    email.trim().toLowerCase() !== data.email.toLowerCase() ||
    newPassword.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !dirty) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setSuccess(false);
    setFieldErrors({});

    try {
      const response = await fetch("/api/account/access", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          newPassword,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        fieldErrors?: AccountAccessFieldErrors;
      };

      if (!response.ok || !result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? "Access settings could not be saved.");
        return;
      }

      setNewPassword("");
      setSuccess(true);
      setMessage(result.message ?? "Access settings were saved.");
      router.refresh();
    } catch {
      setMessage("A network error occurred. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function startEnrollment() {
    if (mfaBusy) {
      return;
    }

    setMfaBusy(true);
    setMessage(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/account/access/mfa", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "enroll" }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        factorId?: string;
        qrCode?: string;
        secret?: string;
      };

      if (!response.ok || !result.ok || !result.factorId || !result.qrCode) {
        setMessage(
          result.message ?? "Two-factor authentication could not be started.",
        );
        return;
      }

      setEnrollment({
        factorId: result.factorId,
        qrCode: result.qrCode,
        secret: result.secret ?? "",
      });
      setVerifyCode("");
    } catch {
      setMessage("A network error occurred. Check your connection and try again.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function confirmEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || mfaBusy) {
      return;
    }

    setMfaBusy(true);
    setMessage(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/account/access/mfa", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify",
          factorId: enrollment.factorId,
          code: verifyCode,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        setMessage(
          result.message ?? "That authenticator code is invalid. Try again.",
        );
        return;
      }

      setEnrollment(null);
      setVerifyCode("");
      setSuccess(true);
      setMessage(result.message ?? "Two-factor authentication is enabled.");
      router.refresh();
    } catch {
      setMessage("A network error occurred. Check your connection and try again.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function disableMfa() {
    if (!data.mfaFactorId || mfaBusy) {
      return;
    }

    setMfaBusy(true);
    setMessage(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/account/access/mfa", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "unenroll",
          factorId: data.mfaFactorId,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        setMessage(
          result.message ?? "Two-factor authentication could not be turned off.",
        );
        return;
      }

      setSuccess(true);
      setMessage(result.message ?? "Two-factor authentication is off.");
      router.refresh();
    } catch {
      setMessage("A network error occurred. Check your connection and try again.");
    } finally {
      setMfaBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {message ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            success
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6"
        noValidate
      >
        <h2 className="text-base font-semibold text-[#1d1d1f]">
          Access information
        </h2>
        <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          This is your access information. You&apos;ll need to introduce your
          password to perform any change.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-600">
            E-mail *
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className={inputClassName}
            />
            {fieldErrors.email ? (
              <span className="mt-1 block text-xs text-rose-600">
                {fieldErrors.email}
              </span>
            ) : null}
          </label>

          <label className="block text-sm font-medium text-slate-600">
            New password
            <span className="relative mt-1.5 block">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Enter new password"
                className={`${inputClassName} mt-0 pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </span>
            <span className="mt-1.5 block text-sm font-normal text-slate-500">
              Enter a new password to change the current one
            </span>
            {fieldErrors.newPassword ? (
              <span className="mt-1 block text-xs text-rose-600">
                {fieldErrors.newPassword}
              </span>
            ) : null}
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading || !dirty}
            className="inline-flex h-11 min-w-[148px] items-center justify-center rounded-md bg-[#2a1728] px-5 text-sm font-semibold text-white transition hover:bg-[#3b2438] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-[#1d1d1f]">
          Two factor authentication
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          To increase the security of your account you can enable 2-factor
          authentication (2FA) with your mobile device.
        </p>

        {!data.mfaAvailable ? (
          <p className="mt-4 text-sm text-slate-500">
            Authenticator 2FA is not enabled on this authentication project yet.
          </p>
        ) : data.mfaEnabled && !enrollment ? (
          <button
            type="button"
            onClick={() => {
              void disableMfa();
            }}
            disabled={mfaBusy}
            className="mt-5 inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-800 disabled:opacity-60"
          >
            {mfaBusy ? "Turning off…" : "Disable"}
          </button>
        ) : enrollment ? (
          <form onSubmit={confirmEnrollment} className="mt-5 space-y-4">
            <p className="text-sm text-slate-600">
              Scan this code in your authenticator app, then enter the 6-digit
              code to finish enabling 2FA.
            </p>
            {/* QR is a data URL from the MFA enroll response. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrollment.qrCode}
              alt="Authenticator QR code"
              className="h-40 w-40 rounded-lg border border-slate-200 bg-white p-2"
            />
            {enrollment.secret ? (
              <p className="text-xs text-slate-500">
                Secret: {enrollment.secret}
              </p>
            ) : null}
            <label className="block max-w-xs text-sm font-medium text-slate-600">
              Authenticator code
              <input
                value={verifyCode}
                onChange={(event) => setVerifyCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className={inputClassName}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={mfaBusy || verifyCode.trim().length !== 6}
                className="inline-flex h-10 items-center rounded-md bg-[#2a1728] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {mfaBusy ? "Verifying…" : "Confirm"}
              </button>
              <button
                type="button"
                disabled={mfaBusy}
                onClick={() => {
                  setEnrollment(null);
                  setVerifyCode("");
                }}
                className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              void startEnrollment();
            }}
            disabled={mfaBusy}
            className="mt-5 inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 disabled:opacity-60"
          >
            {mfaBusy ? "Starting…" : "Enable"}
          </button>
        )}
      </section>
    </div>
  );
}
