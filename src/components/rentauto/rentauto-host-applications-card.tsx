"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type HostApplication = {
  id: string;
  user_id: string;
  status: string;
  applied_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  profile: {
    displayName: string | null;
    email: string | null;
  };
  verificationStatus: string;
  payoutStatus: {
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  };
};

type ListResponse = {
  applications?: HostApplication[];
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

export function RentautoHostApplicationsCard() {
  const [applications, setApplications] = useState<HostApplication[]>([]);
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
      "rentauto-admin-host-applications",
      {
        body: {
          action: "list",
          status: "pending",
        },
      },
    );

    if (invokeError) {
      setError("Host applications could not be loaded.");
      setLoading(false);
      return;
    }

    const response = (data ?? {}) as ListResponse;
    if (response.error) {
      setError(response.error);
      setLoading(false);
      return;
    }

    setApplications(response.applications ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (
    applicationId: string,
    decision: "approved" | "rejected",
  ) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Authentication is not configured for this deployment.");
      return;
    }

    setBusyId(applicationId);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-admin-host-applications",
      {
        body: {
          action: "review",
          applicationId,
          decision,
        },
      },
    );

    const response = (data ?? {}) as ReviewResponse;

    if (invokeError || response.error || !response.ok) {
      setError(response.error ?? "The application could not be reviewed.");
      setBusyId(null);
      return;
    }

    setApplications((current) =>
      current.filter((application) => application.id !== applicationId),
    );
    setBusyId(null);
  };

  return (
    <Card>
      <CardHeader
        title="Pending host applications"
        subtitle="Approval grants the Rentauto host role only. Identity verification and payout readiness remain separate requirements."
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
            <span className="ml-2 text-sm">Loading applications…</span>
          </div>
        ) : applications.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            No pending Rentauto host applications.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {applications.map((application) => {
              const payoutReady =
                application.payoutStatus.chargesEnabled &&
                application.payoutStatus.payoutsEnabled;
              const verificationApproved =
                application.verificationStatus === "approved";
              const disabled = busyId === application.id;

              return (
                <div
                  key={application.id}
                  className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {application.profile.displayName ||
                        application.profile.email ||
                        "Rentauto applicant"}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {application.profile.email || application.user_id}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Applied {dateTime(application.applied_at)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge
                        tone={verificationApproved ? "success" : "warning"}
                      >
                        ID {application.verificationStatus}
                      </Badge>
                      <Badge tone={payoutReady ? "success" : "warning"}>
                        Payouts {payoutReady ? "ready" : "not ready"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void review(application.id, "approved")}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {disabled ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void review(application.id, "rejected")}
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
