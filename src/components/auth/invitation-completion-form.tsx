"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import {
  type InvitationCompletionField,
  type InvitationCompletionFieldErrors,
  type InvitationCompletionInput,
  validateInvitationCompletion,
} from "@/lib/auth/invitation-completion-validation";
import {
  getPasswordRequirements,
  REGISTRATION_LIMITS,
} from "@/lib/auth/registration-validation";

type InvitationCompletionResponse = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
  fieldErrors?: InvitationCompletionFieldErrors;
};

type InvitationCompletionFormProps = {
  email: string;
  initialFirstName?: string;
  initialLastName?: string;
};

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 text-xs font-medium text-rose-600"
    >
      {message}
    </p>
  );
}

export function InvitationCompletionForm({
  email,
  initialFirstName = "",
  initialLastName = "",
}: InvitationCompletionFormProps) {
  const router = useRouter();
  const formReference =
    useRef<HTMLFormElement>(null);

  const submissionInProgress =
    useRef(false);

  const [values, setValues] =
    useState<InvitationCompletionInput>({
      firstName: initialFirstName,
      lastName: initialLastName,
      password: "",
      confirmPassword: "",
    });

  const [fieldErrors, setFieldErrors] =
    useState<InvitationCompletionFieldErrors>(
      {},
    );

  const [globalError, setGlobalError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const passwordRequirements =
    useMemo(
      () =>
        getPasswordRequirements(
          values.password,
        ),
      [values.password],
    );

  const passwordRequirementItems = [
    {
      key: "length",
      met:
        passwordRequirements.minimumLength &&
        passwordRequirements.maximumLength,
      text: `${REGISTRATION_LIMITS.passwordMinimum}–${REGISTRATION_LIMITS.passwordMaximum} characters`,
    },
    {
      key: "uppercase",
      met: passwordRequirements.uppercase,
      text: "One uppercase letter",
    },
    {
      key: "lowercase",
      met: passwordRequirements.lowercase,
      text: "One lowercase letter",
    },
    {
      key: "number",
      met: passwordRequirements.number,
      text: "One number",
    },
    {
      key: "special",
      met:
        passwordRequirements.specialCharacter,
      text: "One special character",
    },
    {
      key: "characters",
      met:
        values.password.length > 0 &&
        passwordRequirements.noSpaces &&
        passwordRequirements.validCharacters,
      text:
        "No spaces or unsupported characters",
    },
  ];

  function updateField<
    Field extends InvitationCompletionField,
  >(
    field: Field,
    value: InvitationCompletionInput[Field],
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

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

    setGlobalError(null);
  }

  function focusFirstInvalidField(
    errors: InvitationCompletionFieldErrors,
  ) {
    const fieldOrder:
      InvitationCompletionField[] = [
        "firstName",
        "lastName",
        "password",
        "confirmPassword",
      ];

    const firstInvalidField =
      fieldOrder.find((field) =>
        Boolean(errors[field]),
      );

    if (!firstInvalidField) {
      return;
    }

    const fieldElement =
      formReference.current?.elements.namedItem(
        firstInvalidField,
      );

    if (
      fieldElement instanceof HTMLElement
    ) {
      fieldElement.focus();
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

    const validation =
      validateInvitationCompletion(values);

    if (!validation.success) {
      setFieldErrors(
        validation.fieldErrors,
      );

      setGlobalError(
        validation.message,
      );

      focusFirstInvalidField(
        validation.fieldErrors,
      );

      return;
    }

    submissionInProgress.current = true;
    setLoading(true);
    setFieldErrors({});
    setGlobalError(null);

    try {
      const response = await fetch(
        "/api/auth/complete-invitation",
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            firstName:
              validation.data.firstName,
            lastName:
              validation.data.lastName,
            password:
              validation.data.password,
            confirmPassword:
              validation.data
                .confirmPassword,
          }),
        },
      );

      let result:
        InvitationCompletionResponse;

      try {
        result =
          (await response.json()) as InvitationCompletionResponse;
      } catch {
        setGlobalError(
          "The account service returned an invalid response.",
        );

        return;
      }

      if (!response.ok || !result.ok) {
        const responseFieldErrors =
          result.fieldErrors ?? {};

        setFieldErrors(
          responseFieldErrors,
        );

        setGlobalError(
          result.message ??
            "Your account setup could not be completed.",
        );

        focusFirstInvalidField(
          responseFieldErrors,
        );

        return;
      }

      router.replace(
        result.redirectTo ??
          "/dashboard",
      );

      router.refresh();
    } catch {
      setGlobalError(
        "A network error occurred. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      submissionInProgress.current =
        false;
    }
  }

  const inputClassName =
    "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

  const passwordInputClassName =
    "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <form
      ref={formReference}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={loading}
      className="space-y-5"
    >
      <div>
        <label
          htmlFor="invited-email"
          className="mb-1.5 block text-xs font-semibold text-slate-700"
        >
          Invited email
        </label>

        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />

          <input
            id="invited-email"
            type="email"
            value={email}
            disabled
            readOnly
            className={inputClassName}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
              maxLength={
                REGISTRATION_LIMITS.firstNameMaximum
              }
              value={values.firstName}
              disabled={loading}
              aria-invalid={Boolean(
                fieldErrors.firstName,
              )}
              aria-describedby={
                fieldErrors.firstName
                  ? "invitation-first-name-error"
                  : undefined
              }
              onChange={(event) =>
                updateField(
                  "firstName",
                  event.target.value,
                )
              }
              placeholder="First name"
              className={inputClassName}
            />
          </div>

          <FieldError
            id="invitation-first-name-error"
            message={
              fieldErrors.firstName
            }
          />
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
              maxLength={
                REGISTRATION_LIMITS.lastNameMaximum
              }
              value={values.lastName}
              disabled={loading}
              aria-invalid={Boolean(
                fieldErrors.lastName,
              )}
              aria-describedby={
                fieldErrors.lastName
                  ? "invitation-last-name-error"
                  : undefined
              }
              onChange={(event) =>
                updateField(
                  "lastName",
                  event.target.value,
                )
              }
              placeholder="Last name"
              className={inputClassName}
            />
          </div>

          <FieldError
            id="invitation-last-name-error"
            message={
              fieldErrors.lastName
            }
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-semibold text-slate-700"
        >
          Create password
        </label>

        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />

          <input
            id="password"
            name="password"
            type={
              showPassword
                ? "text"
                : "password"
            }
            required
            autoComplete="new-password"
            minLength={
              REGISTRATION_LIMITS.passwordMinimum
            }
            maxLength={
              REGISTRATION_LIMITS.passwordMaximum
            }
            value={values.password}
            disabled={loading}
            aria-invalid={Boolean(
              fieldErrors.password,
            )}
            aria-describedby="invitation-password-requirements invitation-password-error"
            onChange={(event) =>
              updateField(
                "password",
                event.target.value,
              )
            }
            placeholder="Create a secure password"
            className={
              passwordInputClassName
            }
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword(
                (current) => !current,
              )
            }
            disabled={loading}
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-700"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        <FieldError
          id="invitation-password-error"
          message={fieldErrors.password}
        />

        <ul
          id="invitation-password-requirements"
          className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2"
        >
          {passwordRequirementItems.map(
            (requirement) => (
              <li
                key={requirement.key}
                className={
                  requirement.met
                    ? "flex items-center gap-2 text-emerald-700"
                    : "flex items-center gap-2 text-slate-500"
                }
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    requirement.met
                      ? "bg-emerald-100"
                      : "bg-slate-100"
                  }`}
                >
                  <Check className="h-3 w-3" />
                </span>

                {requirement.text}
              </li>
            ),
          )}
        </ul>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-xs font-semibold text-slate-700"
        >
          Confirm password
        </label>

        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />

          <input
            id="confirmPassword"
            name="confirmPassword"
            type={
              showConfirmPassword
                ? "text"
                : "password"
            }
            required
            autoComplete="new-password"
            maxLength={
              REGISTRATION_LIMITS.passwordMaximum
            }
            value={
              values.confirmPassword
            }
            disabled={loading}
            aria-invalid={Boolean(
              fieldErrors.confirmPassword,
            )}
            aria-describedby={
              fieldErrors.confirmPassword
                ? "invitation-confirm-password-error"
                : undefined
            }
            onChange={(event) =>
              updateField(
                "confirmPassword",
                event.target.value,
              )
            }
            placeholder="Enter your password again"
            className={
              passwordInputClassName
            }
          />

          <button
            type="button"
            onClick={() =>
              setShowConfirmPassword(
                (current) => !current,
              )
            }
            disabled={loading}
            aria-label={
              showConfirmPassword
                ? "Hide confirmed password"
                : "Show confirmed password"
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-700"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        <FieldError
          id="invitation-confirm-password-error"
          message={
            fieldErrors.confirmPassword
          }
        />
      </div>

      {globalError ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          {globalError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : (
          <LockKeyhole
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}

        {loading
          ? "Completing account…"
          : "Complete account setup"}
      </button>
    </form>
  );
}