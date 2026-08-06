"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  Mail,
  Save,
  UserRound,
} from "lucide-react";
import {
  type ProfileUpdateFieldErrors,
  validateProfileUpdate,
} from "@/lib/auth/profile-validation";

type ProfileUpdateResponse = {
  ok: boolean;
  message?: string;
  fieldErrors?: ProfileUpdateFieldErrors;
};

type ProfileFormProps = {
  email: string;
  initialFirstName: string;
  initialLastName: string;
};

export function ProfileForm({
  email,
  initialFirstName,
  initialLastName,
}: ProfileFormProps) {
  const router = useRouter();
  const formReference = useRef<HTMLFormElement>(null);
  const submissionInProgress = useRef(false);

  const [firstName, setFirstName] =
    useState(initialFirstName);

  const [lastName, setLastName] =
    useState(initialLastName);

  const [fieldErrors, setFieldErrors] =
    useState<ProfileUpdateFieldErrors>({});

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  function clearFieldError(
    field: keyof ProfileUpdateFieldErrors,
  ) {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const updatedErrors = {
        ...currentErrors,
      };

      delete updatedErrors[field];

      return updatedErrors;
    });

    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function focusFirstInvalidField(
    errors: ProfileUpdateFieldErrors,
  ) {
    const firstInvalidField = (
      ["firstName", "lastName"] as const
    ).find((field) => Boolean(errors[field]));

    if (!firstInvalidField) {
      return;
    }

    const element =
      formReference.current?.elements.namedItem(
        firstInvalidField,
      );

    if (element instanceof HTMLElement) {
      element.focus();
    }
  }

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

    const validation = validateProfileUpdate({
      firstName,
      lastName,
    });

    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      setErrorMessage(validation.message);
      focusFirstInvalidField(
        validation.fieldErrors,
      );
      return;
    }

    submissionInProgress.current = true;
    setLoading(true);
    setFieldErrors({});
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        "/api/account/profile",
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName:
              validation.data.firstName,
            lastName:
              validation.data.lastName,
          }),
        },
      );

      let result: ProfileUpdateResponse;

      try {
        result =
          (await response.json()) as ProfileUpdateResponse;
      } catch {
        setErrorMessage(
          "The profile service returned an invalid response.",
        );
        return;
      }

      if (!response.ok || !result.ok) {
        const responseFieldErrors =
          result.fieldErrors ?? {};

        setFieldErrors(responseFieldErrors);

        setErrorMessage(
          result.message ??
            "Your profile could not be updated.",
        );

        focusFirstInvalidField(
          responseFieldErrors,
        );

        return;
      }

      setFirstName(validation.data.firstName);
      setLastName(validation.data.lastName);

      setSuccessMessage(
        result.message ??
          "Your profile was updated successfully.",
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

  const inputClassName =
    "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <form
      ref={formReference}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={loading}
      className="space-y-6"
    >
      <div>
        <label
          htmlFor="profile-email"
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
            id="profile-email"
            type="email"
            value={email}
            readOnly
            disabled
            className={inputClassName}
          />
        </div>

        <p className="mt-1.5 text-xs text-slate-500">
          Email changes require a separate verification process.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            First name
          </label>

          <div className="relative">
            <UserRound
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              maxLength={50}
              value={firstName}
              disabled={loading}
              aria-invalid={Boolean(
                fieldErrors.firstName,
              )}
              aria-describedby={
                fieldErrors.firstName
                  ? "firstName-error"
                  : undefined
              }
              onChange={(event) => {
                setFirstName(event.target.value);
                clearFieldError("firstName");
              }}
              className={inputClassName}
            />
          </div>

          {fieldErrors.firstName ? (
            <p
              id="firstName-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-rose-600"
            >
              {fieldErrors.firstName}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="lastName"
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            Last name
          </label>

          <div className="relative">
            <UserRound
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              maxLength={50}
              value={lastName}
              disabled={loading}
              aria-invalid={Boolean(
                fieldErrors.lastName,
              )}
              aria-describedby={
                fieldErrors.lastName
                  ? "lastName-error"
                  : undefined
              }
              onChange={(event) => {
                setLastName(event.target.value);
                clearFieldError("lastName");
              }}
              className={inputClassName}
            />
          </div>

          {fieldErrors.lastName ? (
            <p
              id="lastName-error"
              role="alert"
              className="mt-1.5 text-xs font-medium text-rose-600"
            >
              {fieldErrors.lastName}
            </p>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          {successMessage}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <Save
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}

          {loading
            ? "Saving changes…"
            : "Save profile"}
        </button>
      </div>
    </form>
  );
}