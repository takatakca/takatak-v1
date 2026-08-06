"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Loader2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

type MembershipStatus = "active" | "suspended";

type StatusUpdateResponse = {
  ok: boolean;
  message?: string;
};

type MemberStatusButtonProps = {
  membershipId: string;
  currentStatus: MembershipStatus;
  memberName: string;
};

export function MemberStatusButton({
  membershipId,
  currentStatus,
  memberName,
}: MemberStatusButtonProps) {
  const router = useRouter();
  const requestInProgress = useRef(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const requestedStatus: MembershipStatus =
    currentStatus === "active"
      ? "suspended"
      : "active";

  const isSuspending =
    requestedStatus === "suspended";

  async function updateStatus() {
    if (loading || requestInProgress.current) {
      return;
    }

    const confirmed = window.confirm(
      isSuspending
        ? `Suspend ${memberName} from this workspace? They will keep their account and access to other workspaces.`
        : `Reactivate ${memberName} in this workspace?`,
    );

    if (!confirmed) {
      return;
    }

    requestInProgress.current = true;
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/team/members/${encodeURIComponent(
          membershipId,
        )}/status`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: requestedStatus,
          }),
        },
      );

      let result: StatusUpdateResponse;

      try {
        result =
          (await response.json()) as StatusUpdateResponse;
      } catch {
        setErrorMessage(
          "The membership service returned an invalid response.",
        );
        return;
      }

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ??
            "The membership status could not be updated.",
        );
        return;
      }

      router.refresh();
    } catch {
      setErrorMessage(
        "A network error occurred. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      requestInProgress.current = false;
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={updateStatus}
        disabled={loading}
        className={
          isSuspending
            ? "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            : "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {loading ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : isSuspending ? (
          <PauseCircle
            aria-hidden="true"
            className="h-4 w-4"
          />
        ) : (
          <PlayCircle
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}

        {loading
          ? "Updating…"
          : isSuspending
            ? "Suspend access"
            : "Reactivate access"}
      </button>

      {errorMessage ? (
        <p
          role="alert"
          className="text-xs font-medium text-rose-600"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}