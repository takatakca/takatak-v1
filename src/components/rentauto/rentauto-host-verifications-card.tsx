"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  IdCard,
  Loader2,
  RefreshCw,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type VerificationReview = {
  id: string;
  userId: string;
  verificationStatus: string;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  profile: {
    displayName: string | null;
    email: string | null;
  };
  documents: {
    idFrontUrl: string | null;
    idBackUrl: string | null;
    selfieUrl: string | null;
    complete: boolean;
  };
};

type ListResponse = {
  verifications?: VerificationReview[];
  error?: string;
};

type ReviewResponse = {
  ok?: boolean;
  error?: string;
};

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

export function RentautoHostVerificationsCard() {
  const [verifications, setVerifications] = useState<VerificationReview[]>([]);
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
      "rentauto-admin-host-verifications",
      { body: { action: "list", status: "pending" } },
    );

    const response = (data ?? {}) as ListResponse;

    if (invokeError || response.error) {
      setError(response.error ?? "Identity verifications could not be loaded.");
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
            "Reason for rejection (shown to the host):",
            "Please upload clear, current identity documents and a matching selfie.",
          )
        : null;

    if (decision === "rejected" && notes === null) return;

    setBusyId(verificationId);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-admin-host-verifications",
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
      setError(response.error ?? "The identity verification could not be reviewed.");
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
        title="Pending host identity verifications"
        subtitle="Government ID and selfie files stay in private Rentauto storage. Approval changes only the Rentauto host verification state."
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
            <span className="ml-2 text-sm">Loading identity reviews…</span>
          </div>
        ) : verifications.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            No host identity verifications are waiting for review.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {verifications.map((verification) => {
              const disabled = busyId === verification.id;
              const applicant =
                verification.profile.displayName ||
                verification.profile.email ||
                verification.userId;

              return (
                <div
                  key={verification.id}
                  className="grid gap-4 py-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {applicant}
                      </p>
                      <Badge tone={verification.documents.complete ? "warning" : "danger"}>
                        {verification.documents.complete
                          ? "Documents ready"
                          : "Documents incomplete"}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {verification.profile.email || verification.userId}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Updated {dateTime(verification.updatedAt)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {verification.documents.idFrontUrl ? (
                        <DocumentLink
                          href={verification.documents.idFrontUrl}
                          label="ID front"
                        />
                      ) : null}
                      {verification.documents.idBackUrl ? (
                        <DocumentLink
                          href={verification.documents.idBackUrl}
                          label="ID back"
                        />
                      ) : null}
                      {verification.documents.selfieUrl ? (
                        <DocumentLink
                          href={verification.documents.selfieUrl}
                          label="Selfie"
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled || !verification.documents.complete}
                      onClick={() => void review(verification.id, "approved")}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {disabled ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
                      )}
                      Approve identity
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

function DocumentLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}
