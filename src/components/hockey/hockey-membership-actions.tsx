"use client";

import { useState } from "react";
import { ArrowRight, CreditCard, Loader2 } from "lucide-react";

export function HockeyMembershipActions({
  paid,
  checkoutLive,
}: {
  paid: boolean;
  checkoutLive: boolean;
}) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState("");

  async function open(kind: "checkout" | "portal") {
    setBusy(kind);
    setError("");

    try {
      const response = await fetch(
        kind === "checkout"
          ? "/api/billing/hockey/checkout"
          : "/api/billing/hockey/portal",
        {
          method: "POST",
          headers:
            kind === "checkout"
              ? { "content-type": "application/json" }
              : undefined,
          body:
            kind === "checkout"
              ? JSON.stringify({ planCode: "hockey_member_weekly_10" })
              : undefined,
          credentials: "same-origin",
        },
      );

      const body = (await response.json()) as {
        ok?: boolean;
        url?: string;
        message?: string;
      };

      if (!response.ok || !body.url) {
        throw new Error(body.message || "Membership billing is unavailable.");
      }

      window.location.assign(body.url);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Membership billing is unavailable.",
      );
      setBusy(null);
    }
  }

  if (paid) {
    return (
      <div>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void open("portal")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
        >
          {busy === "portal" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CreditCard className="h-4 w-4" aria-hidden="true" />
          )}
          Manage membership
        </button>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (!checkoutLive) {
    return (
      <div>
        <button
          type="button"
          disabled
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-200 px-5 text-sm font-semibold text-slate-500"
        >
          Checkout activation pending
        </button>
        <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
          TAKATAK will enable self-serve checkout only after the live Stripe
          weekly Price and dedicated webhook are configured and verified.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void open("checkout")}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60"
      >
        {busy === "checkout" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        )}
        Start at $10/week
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
