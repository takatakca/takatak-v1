"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import { Loader2, Mail, UserPlus } from "lucide-react";
import {
  ROLE_LABELS,
  type RoleKey,
} from "@/lib/security/roles";

type InvitationResponse = {
  ok: boolean;
  message?: string;
  invitationId?: string;
};

type InvitationFormProps = {
  allowedRoles: RoleKey[];
};

export function InvitationForm({
  allowedRoles,
}: InvitationFormProps) {
  const router = useRouter();
  const formReference = useRef<HTMLFormElement>(null);
  const submissionInProgress = useRef(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleKey>(
    allowedRoles[allowedRoles.length - 1] ?? "viewer",
  );

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
      submissionInProgress.current
    ) {
      return;
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Enter an email address.");
      return;
    }

    if (!allowedRoles.includes(role)) {
      setErrorMessage("Select an allowed role.");
      return;
    }

    submissionInProgress.current = true;
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        "/api/team/invitations",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            role,
            customPermissions: [],
            deniedPermissions: [],
          }),
        },
      );

      let result: InvitationResponse;

      try {
        result =
          (await response.json()) as InvitationResponse;
      } catch {
        setErrorMessage(
          "The invitation service returned an invalid response.",
        );
        return;
      }

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ??
            "The invitation could not be sent.",
        );
        return;
      }

      setSuccessMessage(
        result.message ??
          "The invitation was sent successfully.",
      );

      setEmail("");
      formReference.current?.reset();
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
      ref={formReference}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={loading}
      className="space-y-4"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
        <div>
          <label
            htmlFor="invitation-email"
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            Email address
          </label>

          <div className="relative">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              id="invitation-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={320}
              value={email}
              disabled={loading}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              placeholder="person@example.com"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="invitation-role"
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            Workspace role
          </label>

          <select
            id="invitation-role"
            name="role"
            value={role}
            disabled={loading}
            onChange={(event) => {
              setRole(event.target.value as RoleKey);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
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
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            {loading ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <UserPlus
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}

            {loading ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
        >
          {successMessage}
        </p>
      ) : null}
    </form>
  );
}