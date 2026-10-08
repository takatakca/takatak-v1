"use client";

import { useRouter } from "next/navigation";
import { Loader2, Phone, UserRound } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import {
  normalizePersonName,
  validateFirstName,
  validateLastName,
} from "@/lib/auth/registration-validation";
import { normalizePhone, validatePhone } from "@/lib/auth/otp/phone";

type Values = {
  firstName: string;
  lastName: string;
  phone: string;
  acceptedTerms: boolean;
};

const INITIAL: Values = {
  firstName: "",
  lastName: "",
  phone: "",
  acceptedTerms: false,
};

function authMessage(message: string) {
  const value = message.toLowerCase();
  if (value.includes("rate") || value.includes("too many")) {
    return "Too many verification requests. Please wait and try again.";
  }
  if (value.includes("phone") && value.includes("disabled")) {
    return "TAKATAK SMS verification is not enabled yet.";
  }
  if (value.includes("provider")) {
    return "TAKATAK SMS verification provider is not configured.";
  }
  return "Unable to send the TAKATAK verification code. Please try again.";
}

export function MasterPhoneRegistrationForm() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [values, setValues] = useState<Values>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || inFlight.current) return;

    const firstName = normalizePersonName(values.firstName);
    const lastName = normalizePersonName(values.lastName);
    const phone = normalizePhone(values.phone);

    const errors: Record<string, string> = {};
    const firstNameError = validateFirstName(firstName);
    const lastNameError = validateLastName(lastName);
    const phoneError = validatePhone(values.phone);
    if (firstNameError) errors.firstName = firstNameError;
    if (lastNameError) errors.lastName = lastNameError;
    if (phoneError || !phone) errors.phone = phoneError ?? "Enter a valid phone number.";
    if (!values.acceptedTerms) {
      errors.acceptedTerms = "You must agree to the Terms and Privacy Policy.";
    }

    if (Object.keys(errors).length > 0 || !phone) {
      setFieldErrors(errors);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("TAKATAK authentication is not configured.");
      return;
    }

    inFlight.current = true;
    setLoading(true);
    setError(null);

    const capturedAt = new Date().toISOString();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: true,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          display_name: `${firstName} ${lastName}`.trim(),
          phone,
          source_application: "TAKATAK",
          takatak_terms_accepted_at: capturedAt,
          takatak_privacy_accepted_at: capturedAt,
          takatak_consent_captured_at: capturedAt,
        },
      },
    });

    setLoading(false);
    inFlight.current = false;

    if (otpError) {
      setError(authMessage(otpError.message));
      return;
    }

    sessionStorage.setItem("verifyPhone", phone);
    sessionStorage.removeItem("verifyEmail");
    sessionStorage.removeItem("otpAttempts");

    const otpUrl = new URL("/otp", window.location.origin);
    otpUrl.searchParams.set("phone", phone);
    otpUrl.searchParams.set("provider", "supabase-phone");
    router.push(`${otpUrl.pathname}${otpUrl.search}`);
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1.5 block text-xs font-semibold text-foreground">First Name</label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="firstName" autoComplete="given-name" value={values.firstName} disabled={loading} onChange={(event) => update("firstName", event.target.value)} className={inputClass} />
          </div>
          {fieldErrors.firstName ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.firstName}</p> : null}
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1.5 block text-xs font-semibold text-foreground">Last Name</label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="lastName" autoComplete="family-name" value={values.lastName} disabled={loading} onChange={(event) => update("lastName", event.target.value)} className={inputClass} />
          </div>
          {fieldErrors.lastName ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.lastName}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold text-foreground">Mobile number</label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input id="phone" type="tel" autoComplete="tel" inputMode="tel" value={values.phone} disabled={loading} onChange={(event) => update("phone", event.target.value)} className={inputClass} placeholder="+1 514 555 0123" />
        </div>
        {fieldErrors.phone ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.phone}</p> : null}
      </div>

      <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
        <input type="checkbox" checked={values.acceptedTerms} disabled={loading} onChange={(event) => update("acceptedTerms", event.target.checked)} className="mt-1" />
        <span>I agree to the Terms and Privacy Policy for my TAKATAK identity.</span>
      </label>
      {fieldErrors.acceptedTerms ? <p className="text-xs text-rose-600">{fieldErrors.acceptedTerms}</p> : null}

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        TAKATAK owns your master identity. Each GROUPE TAKATAK service receives only the profile fields and permissions it needs; operational and payment data remain separated by service.
      </div>

      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p> : null}

      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60" style={{ backgroundImage: "var(--gradient-hero)" }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {loading ? "Sending TAKATAK code…" : "Verify mobile & create TAKATAK identity"}
      </button>
    </form>
  );
}
