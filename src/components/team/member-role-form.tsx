"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  ROLE_LABELS,
  type RoleKey,
} from "@/lib/security/roles";

type RoleUpdateResponse = {
  ok: boolean;
  message?: string;
};

type MemberRoleFormProps = {
  membershipId: string;
  currentRole: RoleKey;
  allowedRoles: RoleKey[];
};

export function MemberRoleForm({
  membershipId,
  currentRole,
  allowedRoles,
}: MemberRoleFormProps) {
  const router = useRouter();
  const submissionInProgress = useRef(false);

  const [role, setRole] =
    useState<RoleKey>(currentRole);

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      loading ||
      submissionInProgress.current ||
      role === currentRole
    ) {
      return;
    }

    if (!allowedRoles.includes(role)) {
      setErrorMessage(
        "Select a role you are allowed to assign.",
      );
      return;
    }

    submissionInProgress.current = true;
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/team/members/${encodeURIComponent(
          membershipId,
        )}/role`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role,
          }),
        },
      );

      let result: RoleUpdateResponse;

      try {
        result =
          (await response.json()) as RoleUpdateResponse;
      } catch {
        setErrorMessage(
          "The role service returned an invalid response.",
        );
        return;
      }

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ??
            "The workspace role could not be updated.",
        );
        return;
      }

      setSuccessMessage(
        result.message ??
          "The workspace role was updated.",
      );

      router.refresh();
    } catch {
      setErrorMessage(
        "A network error occurred. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      submissionInProgress.current = false;
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="min-w-[220px] space-y-2"
      aria-busy={loading}
    >
      <div className="flex items-center gap-2">
        <select
          aria-label="Workspace role"
          value={role}
          disabled={loading}
          onChange={(event) => {
            setRole(event.target.value as RoleKey);
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        >
          {allowedRoles.map((allowedRole) => (
            <option
              key={allowedRole}
              value={allowedRole}
            >
              {ROLE_LABELS[allowedRole]}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={
            loading ||
            role === currentRole ||
            !allowedRoles.includes(role)
          }
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 p-2.5 text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Save workspace role"
          title="Save workspace role"
        >
          {loading ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <ShieldCheck
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
        </button>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="text-xs font-medium text-rose-600"
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          role="status"
          className="text-xs font-medium text-emerald-600"
        >
          {successMessage}
        </p>
      ) : null}
    </form>
  );
}
