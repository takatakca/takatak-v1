"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  ExternalLink,
  FileImage,
  Loader2,
  RefreshCw,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type DriverVerification = {
  id: string;
  userId: string;
  status: string;
  licenseCountry: string;
  licenseRegion: string | null;
  licenseExpiresOn: string | null;
  reviewerNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  profile: {
    displayName: string | null;
    email: string | null;
    phone: string | null;
  };
  licenseFrontUrl: string | null;
  licenseBackUrl: string | null;
  selfieUrl: string | null;
};

type ListResponse = {
  verifications?: DriverVerification[];
  error?: string;
};

type ReviewResponse = {
  ok?: boolean;
  error?: string;
};

function dateTime(value: string | null): string {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

function dateOnly(value: string | null): string {
  if (!value) return "Missing";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function RentautoDriverVerificationsCard() {
  const [verifications, setVerifications] = useState<DriverVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      setLoading(false);
      return;
    }

    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-admin-driver-verifications",
      { body: { action: "list", status: "pending" } },
    );

    const response = (data ?? {}) as ListResponse;
    if (invokeError || response.error) {
      setError(response.error ?? "Driver verifications could not be loaded.");
      setLoading(false);
      return;
    }

    setVerifications(response.verifications ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (
    verificationId: string,
    decision: "approved" | "rejected",
  ) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      return;
    }

    const notes =
      decision === "rejected"
        ? window.prompt(
            "Reason shown to the driver:",
            "Please upload a clear, current driver licence and selfie.",
          )
        : null;

    if (decision === "rejected" && notes === null) return;

    setBusyId(verificationId);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-admin-driver-verifications",
      {
        body: {
          action: "review",
          verificationId,
          decision,
          notes,
        },
      },
    );

    const response = (data ?? {}) as ReviewResponse;
    if (invokeError || response.error || !response.ok) {
      setError(response.error ?? "The driver verification could not be reviewed.");
      setBusyId(null);
      return;
    }

    setVerifications((current) =>
      current.filter((verification) => verification.id !== verificationId),
    );
    setBusyId(null);
  };

  return (
    <Card>
      <CardHeader
        title="Pending driver verifications"
        subtitle="Licence and selfie review controls renter eligibility. Hosts never receive these documents."
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        }
      />
      <CardBody className="space-y-3">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-24 items-center justify-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span className="ml-2 text-sm">Loading driver reviews…</span>
          </div>
        ) : verifications.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            No driver verifications are waiting for review.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {verifications.map((verification) => {
              const disabled = busyId === verification.id;

              return (
                <div
                  key={verification.id}
                  className="grid gap-4 py-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {verification.profile.displayName ||
                          verification.profile.email ||
                          "Rentauto driver"}
                      </p>
                      <Badge tone="warning">Review pending</Badge>
                    </div>

                    <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                      <span>Email: {verification.profile.email || "Unavailable"}</span>
                      <span>Phone: {verification.profile.phone || "Unavailable"}</span>
                      <span>
                        Licence: {verification.licenseRegion || "—"},{" "}
                        {verification.licenseCountry}
                      </span>
                      <span>Expires: {dateOnly(verification.licenseExpiresOn)}</span>
                      <span>Submitted: {dateTime(verification.submittedAt)}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {verification.licenseFrontUrl ? (
                        <a
                          href={verification.licenseFrontUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
                          Licence front
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                      {verification.licenseBackUrl ? (
                        <a
                          href={verification.licenseBackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
                          Licence back
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                      {verification.selfieUrl ? (
                        <a
                          href={verification.selfieUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Selfie
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void review(verification.id, "approved")}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {disabled ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                      )}
                      Approve driver
                    </button>

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void review(verification.id, "rejected")}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
