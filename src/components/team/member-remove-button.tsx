"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  UserMinus,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/team/confirmation-dialog";

type RemoveMemberResponse = {
  ok: boolean;
  message?: string;
};

type MemberRemoveButtonProps = {
  membershipId: string;
  memberName: string;
};

export function MemberRemoveButton({
  membershipId,
  memberName,
}: MemberRemoveButtonProps) {
  const router = useRouter();
  const requestInProgress = useRef(false);

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
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

  async function removeMember() {
    if (loading || requestInProgress.current) {
      return;
    }

    requestInProgress.current = true;
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/team/members/${encodeURIComponent(
          membershipId,
        )}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        },
      );

      let result: RemoveMemberResponse;

      try {
        result =
          (await response.json()) as RemoveMemberResponse;
      } catch {
        setErrorMessage(
          "The membership service returned an invalid response.",
        );
        return;
      }

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ??
            "The workspace member could not be removed.",
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : (
          <UserMinus
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}

        {loading
          ? "Removing…"
          : "Remove from workspace"}
      </button>

      {errorMessage ? (
        <p
          role="alert"
          className="text-xs font-medium text-rose-600"
        >
          {errorMessage}
        </p>
      ) : null}

      <ConfirmationDialog
        open={dialogOpen}
        title="Remove workspace member?"
        description={`You are about to remove ${memberName} from this workspace. Their TAKATAK account will remain active, and they will keep access to any other workspaces. Are you sure you want to proceed?`}
        loading={loading}
        proceedLabel="Proceed with removal"
        onCancel={cancelConfirmation}
        onProceed={removeMember}
      />
    </div>
  );
}