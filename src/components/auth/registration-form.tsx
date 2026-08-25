"use client";

import Link from "next/link";
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
  Lock,
  Mail,
  UserRound,
  X,
} from "lucide-react";
import {
  getPasswordRequirements,
  hasRegistrationErrors,
  REGISTRATION_LIMITS,
  type RegistrationField,
  type RegistrationFieldErrors,
  type RegistrationInput,
  validateRegistrationInput,
} from "@/lib/auth/registration-validation";

type RegistrationResponse = {
  ok: boolean;
  message?: string;
  fieldErrors?: RegistrationFieldErrors;
  requiresEmailVerification?: boolean;
  redirectTo?: string;
};

const INITIAL_VALUES: RegistrationInput = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
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

export function RegistrationForm() {
  const router = useRouter();
  const formReference = useRef<HTMLFormElement>(null);
  const submissionInProgressReference = useRef(false);

  const [values, setValues] =
    useState<RegistrationInput>(INITIAL_VALUES);

  const [fieldErrors, setFieldErrors] =
    useState<RegistrationFieldErrors>({});

  const [globalError, setGlobalError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const passwordRequirements = useMemo(
    () => getPasswordRequirements(values.password),
    [values.password],
  );

  const passwordStrength = useMemo(() => {
    if (!values.password) {
      return {
        score: 0,
        label: "Not entered",
      };
    }

    const checks = [
      passwordRequirements.minimumLength,
      passwordRequirements.maximumLength,
      passwordRequirements.uppercase,
      passwordRequirements.lowercase,
      passwordRequirements.number,
      passwordRequirements.specialCharacter,
      passwordRequirements.noSpaces,
      passwordRequirements.validCharacters,
    ];

    const passedChecks = checks.filter(Boolean).length;

    if (passedChecks <= 3) {
      return {
        score: 1,
        label: "Weak",
      };
    }

    if (passedChecks <= 5) {
      return {
        score: 2,
        label: "Fair",
      };
    }

    if (passedChecks <= 7) {
      return {
        score: 3,
        label: "Good",
      };
    }

    return {
      score: 4,
      label: "Strong",
    };
  }, [passwordRequirements, values.password]);

  function updateField<K extends keyof RegistrationInput>(
    field: K,
    value: RegistrationInput[K],
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
    setSuccessMessage(null);
  }

  function focusFirstInvalidField(
    errors: RegistrationFieldErrors,
  ) {
    const fieldOrder: RegistrationField[] = [
      "firstName",
      "lastName",
      "email",
      "password",
      "confirmPassword",
      "acceptedTerms",
    ];

    const firstInvalidField = fieldOrder.find((field) =>
      Boolean(errors[field]),
    );

    if (!firstInvalidField) {
      return;
    }

    const fieldElement =
      formReference.current?.elements.namedItem(
        firstInvalidField,
      );

    if (fieldElement instanceof HTMLElement) {
      fieldElement.focus();
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      submissionInProgressReference.current ||
      loading
    ) {
      return;
    }

    submissionInProgressReference.current = true;
    setGlobalError(null);
    setSuccessMessage(null);

    const validation = validateRegistrationInput(values);

    if (hasRegistrationErrors(validation.errors)) {
      setFieldErrors(validation.errors);
      focusFirstInvalidField(validation.errors);
      submissionInProgressReference.current = false;
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });

      let result: RegistrationResponse;

      try {
        result =
          (await response.json()) as RegistrationResponse;
      } catch {
        setGlobalError(
          "The registration service returned an invalid response. Please try again.",
        );
        return;
      }

      if (!response.ok || !result.ok) {
        const responseFieldErrors =
          result.fieldErrors ?? {};

        setFieldErrors(responseFieldErrors);

        setGlobalError(
          result.message ??
            "Unable to create your account.",
        );

        focusFirstInvalidField(responseFieldErrors);
        return;
      }

      setSuccessMessage(
        result.message ?? "Account created successfully.",
      );

      router.push(
        result.redirectTo ??
          (result.requiresEmailVerification
            ? "/register/verify"
            : "/dashboard"),
      );

      router.refresh();
    } catch {
      setGlobalError(
        "A network error occurred. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      submissionInProgressReference.current = false;
    }
  }

  const strengthSegmentClasses = [1, 2, 3, 4].map(
    (segment) => {
      if (passwordStrength.score < segment) {
        return "bg-slate-200";
      }

      if (passwordStrength.score === 1) {
        return "bg-rose-500";
      }

      if (passwordStrength.score === 2) {
        return "bg-amber-500";
      }

      if (passwordStrength.score === 3) {
        return "bg-blue-500";
      }

      return "bg-emerald-500";
    },
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
      key: "specialCharacter",
      met: passwordRequirements.specialCharacter,
      text: "One special character",
    },
    {
      key: "characters",
      met:
        values.password.length > 0 &&
        passwordRequirements.noSpaces &&
        passwordRequirements.validCharacters,
      text: "No spaces or unsupported characters",
    },
  ];

  const inputClassName =
    "w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

  const passwordInputClassName =
    "w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-11 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

  return (
    <form
      ref={formReference}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
      aria-busy={loading}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="mb-1.5 block text-xs font-semibold text-foreground"
          >
            First Name
          </label>

          <div className="relative">
            <UserRound
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
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
                  ? "firstName-error"
                  : undefined
              }
              onChange={(event) =>
                updateField(
                  "firstName",
                  event.target.value,
                )
              }
              className={inputClassName}
              placeholder="First name"
            />
          </div>

          <FieldError
            id="firstName-error"
            message={fieldErrors.firstName}
          />
        </div>

        <div>
          <label
            htmlFor="lastName"
            className="mb-1.5 block text-xs font-semibold text-foreground"
          >
            Last Name
          </label>

          <div className="relative">
            <UserRound
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
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
                  ? "lastName-error"
                  : undefined
              }
              onChange={(event) =>
                updateField(
                  "lastName",
                  event.target.value,
                )
              }
              className={inputClassName}
              placeholder="Last name"
            />
          </div>

          <FieldError
            id="lastName-error"
            message={fieldErrors.lastName}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          Email
        </label>

        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="email"
            name="email"
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={REGISTRATION_LIMITS.emailMaximum}
            value={values.email}
            disabled={loading}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={
              fieldErrors.email
                ? "email-error"
                : undefined
            }
            onChange={(event) =>
              updateField("email", event.target.value)
            }
            className={inputClassName}
            placeholder="you@company.com"
          />
        </div>

        <FieldError
          id="email-error"
          message={fieldErrors.email}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          Password
        </label>

        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            value={values.password}
            disabled={loading}
            aria-invalid={Boolean(
              fieldErrors.password,
            )}
            aria-describedby="password-requirements password-error"
            onChange={(event) =>
              updateField(
                "password",
                event.target.value,
              )
            }
            className={passwordInputClassName}
            placeholder="Create a strong password"
          />

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              setShowPassword(
                (currentValue) => !currentValue,
              )
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff
                className="h-4 w-4"
                aria-hidden="true"
              />
            ) : (
              <Eye
                className="h-4 w-4"
                aria-hidden="true"
              />
            )}
          </button>
        </div>

        <FieldError
          id="password-error"
          message={fieldErrors.password}
        />

        <div
          id="password-requirements"
          className="mt-3 rounded-lg bg-muted/60 p-3 ring-1 ring-inset ring-border"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              Password strength
            </p>

            <p
              className="text-xs font-medium text-muted-foreground"
              aria-live="polite"
            >
              {passwordStrength.label}
            </p>
          </div>

          <div
            className="mt-2 grid grid-cols-4 gap-1"
            aria-hidden="true"
          >
            {strengthSegmentClasses.map(
              (className, index) => (
                <span
                  key={index}
                  className={`h-1.5 rounded-full transition ${className}`}
                />
              ),
            )}
          </div>

          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {passwordRequirementItems.map(
              (requirement) => (
                <li
                  key={requirement.key}
                  className={`flex items-center gap-1.5 text-xs ${
                    requirement.met
                      ? "text-emerald-700"
                      : "text-slate-500"
                  }`}
                >
                  {requirement.met ? (
                    <Check
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <X
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}

                  {requirement.text}
                </li>
              ),
            )}
          </ul>
        </div>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          Confirm Password
        </label>

        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="confirmPassword"
            name="confirmPassword"
            type={
              showConfirmPassword ? "text" : "password"
            }
            required
            autoComplete="new-password"
            value={values.confirmPassword}
            disabled={loading}
            aria-invalid={Boolean(
              fieldErrors.confirmPassword,
            )}
            aria-describedby={
              fieldErrors.confirmPassword
                ? "confirmPassword-error"
                : undefined
            }
            onChange={(event) =>
              updateField(
                "confirmPassword",
                event.target.value,
              )
            }
            className={passwordInputClassName}
            placeholder="Repeat your password"
          />

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              setShowConfirmPassword(
                (currentValue) => !currentValue,
              )
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
            aria-label={
              showConfirmPassword
                ? "Hide confirmed password"
                : "Show confirmed password"
            }
            aria-pressed={showConfirmPassword}
          >
            {showConfirmPassword ? (
              <EyeOff
                className="h-4 w-4"
                aria-hidden="true"
              />
            ) : (
              <Eye
                className="h-4 w-4"
                aria-hidden="true"
              />
            )}
          </button>
        </div>

        <FieldError
          id="confirmPassword-error"
          message={fieldErrors.confirmPassword}
        />
      </div>

      <div>
        <div className="flex items-start gap-2.5">
          <input
            id="acceptedTerms"
            name="acceptedTerms"
            type="checkbox"
            required
            checked={values.acceptedTerms}
            disabled={loading}
            aria-invalid={Boolean(
              fieldErrors.acceptedTerms,
            )}
            aria-describedby={
              fieldErrors.acceptedTerms
                ? "acceptedTerms-error"
                : undefined
            }
            onChange={(event) =>
              updateField(
                "acceptedTerms",
                event.target.checked,
              )
            }
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          />

          <label
            htmlFor="acceptedTerms"
            className="text-xs leading-5 text-muted-foreground"
          >
            I agree to the{" "}
            <Link
              href="/terms"
              className="font-semibold text-primary hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-semibold text-primary hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        <FieldError
          id="acceptedTerms-error"
          message={fieldErrors.acceptedTerms}
        />
      </div>

      {globalError ? (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          {globalError}
        </p>
      ) : null}

      {successMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"
        >
          {successMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        aria-disabled={loading}
        aria-busy={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        {loading ? (
          <Loader2
            className="h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        ) : null}

        {loading ? "Creating account…" : "Create Account"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Go to Login
        </Link>
      </p>
    </form>
  );
}