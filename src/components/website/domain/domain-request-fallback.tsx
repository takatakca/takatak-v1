"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  Search,
} from "lucide-react";

import {
  SUPPORTED_DOMAIN_TLDS,
  type SupportedDomainTld,
} from "@/lib/website/upmind-config";

function cleanDomain(
  value: string,
  tld: string,
): string {
  const raw = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0] ?? "";

  const selectedTld =
    tld.replace(/^\./, "");

  if (
    raw.endsWith(
      `.${selectedTld}`,
    )
  ) {
    return raw;
  }

  const firstLabel =
    raw.split(".")[0] ?? raw;

  return `${firstLabel}.${selectedTld}`;
}

function validateDomain(
  domain: string,
): string | null {
  if (
    !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(
      domain,
    )
  ) {
    return "Enter a valid domain such as yourbrand.ca.";
  }

  if (domain.includes("..")) {
    return "Domain names cannot contain consecutive dots.";
  }

  if (
    domain
      .split(".")
      .some(
        (part) =>
          part.length === 0 ||
          part.startsWith("-") ||
          part.endsWith("-"),
      )
  ) {
    return "Domain labels cannot start or end with a hyphen.";
  }

  return null;
}

export function DomainRequestFallback({
  diagnosticCode,
}: {
  diagnosticCode?: string;
}) {
  const router = useRouter();

  const [domain, setDomain] =
    useState("yourbrand");

  const [tld, setTld] =
    useState<SupportedDomainTld>(
      "ca",
    );

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [error, setError] =
    useState<string | null>(null);

  const fullDomain = useMemo(
    () => cleanDomain(domain, tld),
    [domain, tld],
  );

  function submit(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    setError(null);

    const validationError =
      validateDomain(fullDomain);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!email.trim() && !phone.trim()) {
      setError(
        "Add an email or phone number so TAKATAK can contact you.",
      );

      return;
    }

    const parameters =
      new URLSearchParams({
        next: "/domain",
        domain: fullDomain,
        promo: "FIRST10",
      });

    if (name.trim()) {
      parameters.set(
        "name",
        name.trim(),
      );
    }

    if (email.trim()) {
      parameters.set(
        "email",
        email.trim(),
      );
    }

    if (phone.trim()) {
      parameters.set(
        "phone",
        phone.trim(),
      );
    }

    router.push(
      `/register?${parameters.toString()}`,
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <AlertTriangle size={18} />
        </div>

        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">
            Domain search is temporarily
            unavailable
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            We’ll verify availability and
            contact you before
            registration.
          </p>

          {process.env.NODE_ENV ===
            "development" &&
          diagnosticCode ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Diagnostic:{" "}
              {diagnosticCode}
            </p>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={submit}
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]"
      >
        <label
          className="sr-only"
          htmlFor="fallback-domain"
        >
          Domain
        </label>

        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-3 focus-within:border-primary">
          <Search
            size={17}
            className="shrink-0 text-muted-foreground"
          />

          <input
            id="fallback-domain"
            value={domain}
            onChange={(event) =>
              setDomain(
                event.target.value,
              )
            }
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="yourbrand"
          />
        </div>

        <select
          value={tld}
          onChange={(event) =>
            setTld(
              event.target
                .value as SupportedDomainTld,
            )
          }
          className="rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
        >
          {SUPPORTED_DOMAIN_TLDS.map(
            (extension) => (
              <option
                key={extension}
                value={extension}
              >
                .{extension}
              </option>
            ),
          )}
        </select>

        <input
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          className="rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary sm:col-span-2"
          placeholder="Name"
        />

        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
          <input
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value,
              )
            }
            type="email"
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
            placeholder="Email"
          />

          <input
            value={phone}
            onChange={(event) =>
              setPhone(
                event.target.value,
              )
            }
            className="rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
            placeholder="Phone"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive sm:col-span-2">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground sm:col-span-2"
        >
          Request domain registration
          <ArrowRight size={15} />
        </button>
      </form>
    </div>
  );
}