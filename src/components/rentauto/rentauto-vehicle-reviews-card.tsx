"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type VehicleReview = {
  id: string;
  hostId: string;
  title: string;
  make: string;
  model: string;
  year: number;
  status: string;
  insuranceStatus: string;
  vin: string | null;
  plateNumber: string | null;
  updatedAt: string;
  host: {
    displayName: string | null;
    email: string | null;
  };
  registrationDocumentUrl: string | null;
  insuranceDocumentUrl: string | null;
};

type ListResponse = {
  vehicles?: VehicleReview[];
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

export function RentautoVehicleReviewsCard() {
  const [vehicles, setVehicles] = useState<VehicleReview[]>([]);
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
      "rentauto-admin-vehicle-reviews",
      { body: { action: "list", status: "pending" } },
    );

    const response = (data ?? {}) as ListResponse;

    if (invokeError || response.error) {
      setError(response.error ?? "Vehicle reviews could not be loaded.");
      setLoading(false);
      return;
    }

    setVehicles(response.vehicles ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (
    carId: string,
    decision: "verified" | "rejected",
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
            "Please upload clear, current registration and insurance documents.",
          )
        : null;

    if (decision === "rejected" && notes === null) return;

    setBusyId(carId);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-admin-vehicle-reviews",
      {
        body: {
          action: "review",
          carId,
          decision,
          notes,
        },
      },
    );

    const response = (data ?? {}) as ReviewResponse;

    if (invokeError || response.error || !response.ok) {
      setError(response.error ?? "The vehicle could not be reviewed.");
      setBusyId(null);
      return;
    }

    setVehicles((current) =>
      current.filter((vehicle) => vehicle.id !== carId),
    );
    setBusyId(null);
  };

  return (
    <Card>
      <CardHeader
        title="Pending vehicle document reviews"
        subtitle="Registration and proof of insurance stay private. Approval verifies documents only; it does not automatically publish the listing."
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
            <span className="ml-2 text-sm">Loading vehicle reviews…</span>
          </div>
        ) : vehicles.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            No vehicle documents are waiting for review.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {vehicles.map((vehicle) => {
              const disabled = busyId === vehicle.id;
              return (
                <div
                  key={vehicle.id}
                  className="grid gap-4 py-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                      <Badge tone="warning">Documents pending</Badge>
                      <Badge>{vehicle.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {vehicle.title || "Untitled Rentauto listing"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Host: {vehicle.host.displayName || vehicle.host.email || vehicle.hostId}
                    </p>
                    <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                      <span>VIN: {vehicle.vin || "Missing"}</span>
                      <span>Plate: {vehicle.plateNumber || "Missing"}</span>
                      <span>Submitted/updated: {dateTime(vehicle.updatedAt)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {vehicle.registrationDocumentUrl ? (
                        <a
                          href={vehicle.registrationDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Registration
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                      {vehicle.insuranceDocumentUrl ? (
                        <a
                          href={vehicle.insuranceDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Insurance
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void review(vehicle.id, "verified")}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {disabled ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      )}
                      Approve documents
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void review(vehicle.id, "rejected")}
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
