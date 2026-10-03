"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  CirclePause,
  CirclePlay,
  Loader2,
  PlusCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

export interface RentautoProvisioningRow {
  clientId: string;
  clientName: string;
  clientStatus: string;
  serviceId: string | null;
  serviceStatus: string | null;
  duplicateCount: number;
}

type ManagedStatus =
  | "pending_setup"
  | "active"
  | "paused";

type ApiResult = {
  ok: boolean;
  message?: string;
};

function statusTone(
  status: string | null,
): "success" | "warning" | "neutral" | "danger" {
  if (status === "active") return "success";
  if (status === "pending_setup") return "warning";
  if (status === "paused") return "neutral";
  return "neutral";
}

function actionFor(row: RentautoProvisioningRow): {
  label: string;
  status: ManagedStatus;
  icon: typeof PlusCircle;
} {
  if (!row.serviceStatus) {
    return {
      label: "Provision",
      status: "pending_setup",
      icon: PlusCircle,
    };
  }

  if (row.serviceStatus === "active") {
    return {
      label: "Pause",
      status: "paused",
      icon: CirclePause,
    };
  }

  return {
    label:
      row.serviceStatus === "paused"
        ? "Reactivate"
        : "Activate",
    status: "active",
    icon: CirclePlay,
  };
}

export function AdminRentautoProvisioning({
  rows,
  enabled,
}: {
  rows: RentautoProvisioningRow[];
  enabled: boolean;
}) {
  const router = useRouter();
  const inFlight = useRef<Set<string>>(new Set());
  const [busyClientId, setBusyClientId] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  async function updateStatus(
    row: RentautoProvisioningRow,
    status: ManagedStatus,
  ) {
    if (
      !enabled ||
      row.duplicateCount > 0 ||
      inFlight.current.has(row.clientId)
    ) {
      return;
    }

    inFlight.current.add(row.clientId);
    setBusyClientId(row.clientId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/clients/${encodeURIComponent(
          row.clientId,
        )}/services/rentauto`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      const result =
        (await response.json()) as ApiResult;

      if (!response.ok || !result.ok) {
        setError(
          result.message ??
            "RENTAUTO.CA access could not be updated.",
        );
        return;
      }

      setMessage(
        result.message ??
          "RENTAUTO.CA access updated.",
      );
      router.refresh();
    } catch {
      setError(
        "A network error occurred while updating RENTAUTO.CA access.",
      );
    } finally {
      inFlight.current.delete(row.clientId);
      setBusyClientId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              RENTAUTO.CA provisioning
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
              A workspace sees the Rentauto dashboard only while its Rentauto
              service is pending setup or active. Vehicle, booking and payment
              operations remain inside RENTAUTO.CA.
            </p>
          </div>
          <Badge tone={enabled ? "success" : "neutral"}>
            {enabled
              ? "Platform write controls"
              : "Foundation preview"}
          </Badge>
        </div>

        {message ? (
          <p className="mt-3 text-xs font-medium text-emerald-700">
            {message}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-3 text-xs font-medium text-rose-700"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No client workspaces are available for provisioning.
          </p>
        ) : (
          rows.map((row) => {
            const action = actionFor(row);
            const ActionIcon = action.icon;
            const busy =
              busyClientId === row.clientId;
            const conflict =
              row.duplicateCount > 0;

            return (
              <div
                key={row.clientId}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {row.clientName}
                    </p>
                    <Badge
                      tone={statusTone(
                        row.serviceStatus,
                      )}
                    >
                      {row.serviceStatus ??
                        "not provisioned"}
                    </Badge>
                    {row.clientStatus !== "active" ? (
                      <Badge tone="warning">
                        Workspace {row.clientStatus}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {conflict
                      ? `Configuration conflict: ${row.duplicateCount + 1} Rentauto service records exist.`
                      : row.serviceStatus === "active"
                        ? "Rentauto module is visible to this workspace."
                        : row.serviceStatus === "pending_setup"
                          ? "Module is visible while onboarding is completed."
                          : "Rentauto module is hidden from this workspace."}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    !enabled ||
                    conflict ||
                    busy
                  }
                  onClick={() =>
                    void updateStatus(
                      row,
                      action.status,
                    )
                  }
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ActionIcon className="h-4 w-4" />
                  )}
                  {busy
                    ? "Updating…"
                    : action.label}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
