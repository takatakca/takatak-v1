"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  Trash2,
} from "lucide-react";
import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import { ConfirmationDialog } from "@/components/team/confirmation-dialog";

type DeleteUserResponse = {
  ok: boolean;
  message?: string;
};

type AdminUserDeleteButtonProps = {
  profileId: string;
  displayName: string | null;
  email: string | null;
  blockedReason?: string | null;
};

export function AdminUserDeleteButton({
  profileId,
  displayName,
  email,
  blockedReason = null,
}: AdminUserDeleteButtonProps) {
  const fr = useDashboardLanguage() === "fr";
  const router = useRouter();
  const requestInProgress =
    useRef(false);

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

    document.body.style.overflow =
      "hidden";

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
    if (blockedReason) {
      return;
    }

    setErrorMessage(null);
    setDialogOpen(true);
  }

  function cancelConfirmation() {
    if (loading) {
      return;
    }

    setDialogOpen(false);
  }

  async function deleteUser() {
    if (
      blockedReason ||
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
        `/api/admin/users/${encodeURIComponent(
          profileId,
        )}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        },
      );

      let result: DeleteUserResponse;

      try {
        result =
          (await response.json()) as DeleteUserResponse;
      } catch {
        setErrorMessage(
          fr ? "Le service des comptes a donné une réponse invalide." : "The account service returned an invalid response.",
        );

        return;
      }

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ??
            (fr ? "Le compte de l’utilisateur n’a pas pu être supprimé." : "The user account could not be deleted."),
        );

        return;
      }

      setDialogOpen(false);
      router.refresh();
    } catch {
      setErrorMessage(
        fr ? "Erreur réseau. Vérifiez votre connexion et réessayez." : "A network error occurred. Check your connection and try again.",
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
        disabled={
          loading ||
          Boolean(blockedReason)
        }
        title={
          blockedReason ??
          (fr ? "Supprimer cet utilisateur pour de bon" : "Permanently delete this user")
        }
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
      >
        {loading ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : (
          <Trash2
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}

        {loading
          ? fr ? "Suppression…" : "Deleting…"
          : fr ? "Supprimer le compte" : "Delete account"}
      </button>

      {blockedReason ? (
        <p className="max-w-56 text-[11px] leading-relaxed text-slate-400">
          {blockedReason}
        </p>
      ) : null}

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
        title={fr ? "Supprimer cet utilisateur pour de bon ?" : "Permanently delete user?"}
        description={
          fr
            ? `Vous allez supprimer pour de bon ${displayName ?? "cette identité TAKATAK"}${email ? ` (${email})` : ""}. Sa connexion Supabase, son profil dans l’application et toutes ses appartenances aux espaces seront retirés. Cette action est irréversible.`
            : `You are about to permanently delete ${displayName ?? "this TAKATAK identity"}${email ? ` (${email})` : ""}. Their Supabase login, application profile, and all workspace memberships will be removed. This action cannot be undone.`
        }
        loading={loading}
        proceedLabel={fr ? "Supprimer pour de bon" : "Permanently delete user"}
        onCancel={cancelConfirmation}
        onProceed={deleteUser}
      />
    </div>
  );
}