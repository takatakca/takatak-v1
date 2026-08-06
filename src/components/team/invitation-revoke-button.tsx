"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Ban,
  Loader2,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/team/confirmation-dialog";

type RevokeInvitationResponse = {
  ok: boolean;
  message?: string;
};

type InvitationRevokeButtonProps = {
  invitationId: string;
  email: string;
};

export function InvitationRevokeButton({
  invitationId,
  email,
}: InvitationRevokeButtonProps) {
  const router = useRouter();
  const requestInProgress = useRef(false);

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !loading
      ) {
        setDialogOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [dialogOpen, loading]);

  function openConfirmation() {
    setErrorMessage(null);
    setDialogOpen(true);
  }

  function cancelConfirmation() {
    if (loading) {
      return;
    }

    setDialogOpen(false);
  }

  async function revokeInvitation() {
    if (
      loading ||
      requestInProgress.current
    ) {
      return;
    }

    requestInProgress.current = true;
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/team/invitations/${encodeURIComponent(
          invitationId,
        )}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        },
      );

      let result: RevokeInvitationResponse;

      try {
        result =
          (await response.json()) as RevokeInvitationResponse;
      } catch {
        setErrorMessage(
          "The invitation service returned an invalid response.",
        );
        return;
      }

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ??
            "The invitation could not be revoked.",
        );
        return;
      }

      setDialogOpen(false);
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
        onClick={openConfirmation}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : (
          <Ban
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}

        {loading
          ? "Revoking…"
          : "Revoke"}
      </button>

      {errorMessage ? (
        <p
          role="alert"
          className="max-w-56 text-xs font-medium text-rose-600"
        >
          {errorMessage}
        </p>
      ) : null}

      <ConfirmationDialog
        open={dialogOpen}
        title="Revoke invitation?"
        description={`You are about to revoke the pending invitation for ${email}. The current invitation link will immediately stop working, but the invitation record will remain available until it is deleted.`}
        loading={loading}
        proceedLabel="Proceed with revocation"
        onCancel={cancelConfirmation}
        onProceed={revokeInvitation}
      />
    </div>
  );
}