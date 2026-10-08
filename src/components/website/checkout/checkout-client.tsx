"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, ShieldCheck } from "lucide-react";
import { IoArrowBack } from "react-icons/io5";

import { CheckoutScrollArrow } from "@/components/website/checkout/checkout-scroll-arrow";
import { DomainSearchDesk } from "@/components/website/domain/domain-search-desk";
import { UpmindHostingPlans } from "@/components/website/hosting/upmind-hosting-plans";
import {
  clearCheckoutSelection,
  readCheckoutSelection,
  type CheckoutSelection,
} from "@/lib/website/marketplace-storage";
import { submitWebsiteRequest } from "@/lib/website/website-requests";
import styles from "./checkout-domain.module.css";

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function MarketplaceOrder({
  selection,
  onClear,
  onSent,
}: {
  selection: CheckoutSelection;
  onClear: () => void;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [confirmedTotal, setConfirmedTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendOrder() {
    setSending(true);
    setError(null);
    const result = await submitWebsiteRequest({
      kind: "package_order",
      packageId: selection.packageId,
      tierName: selection.tierName,
      addons: selection.addons.map((item) => item.label),
      promoCode: selection.promoCode ?? undefined,
      sourcePage: "/checkout",
    });
    setSending(false);
    if (result.status === "sent") {
      setReference(result.reference);
      setConfirmedTotal(result.totalCents ?? selection.finalTotalCents);
      onSent();
      return;
    }
    if (result.status === "rate_limited") {
      setError("Too many requests were sent. Please wait a few minutes and try again.");
      return;
    }
    if (result.status === "invalid") {
      setError("This package is no longer available as selected. Please choose it again from the marketplace.");
      return;
    }
    setError("We couldn't send your order right now. Your selection is kept — please try again shortly or email support@takatak.ca.");
  }

  if (reference) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Order received</h1>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                TAKATAK received your order for “{selection.title}” ({selection.tierName}).
                A specialist will confirm the scope and send your invoice. Nothing is charged
                until you approve it.
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Reference: {reference}
                {confirmedTotal !== null ? ` · Quoted total ${dollars(confirmedTotal)} CAD` : null}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/marketplace" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
                  Back to marketplace
                </Link>
                <Link href="/dashboard" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">
                  Go to my dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-950 md:text-4xl">
          Review your TAKATAK order
        </h1>
        <p className="mt-2 text-slate-600">
          Confirm the selected package and send it to TAKATAK. A specialist
          confirms the scope before anything is charged.
        </p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-[#090a1a] px-6 py-4 text-white">
            <span className="inline-flex items-center gap-2 font-semibold">
              <ShieldCheck size={17} className="text-sky-400" />
              TAKATAK order summary
            </span>
            <span className="text-xs text-slate-400">CAD</span>
          </div>
          <div className="p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              {selection.category}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              {selection.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {selection.tierName} tier · {selection.deliveryDays}-day delivery
            </p>
            <div className="mt-6 space-y-3 border-y border-slate-200 py-5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Package</span>
                <span className="font-medium text-slate-950">
                  {dollars(selection.tierPriceCents)}
                </span>
              </div>
              {selection.addons.map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Check size={13} className="text-primary" />
                    {item.label}
                  </span>
                  <span className="font-medium text-slate-950">
                    {dollars(item.priceCents)}
                  </span>
                </div>
              ))}
              {selection.discountCents > 0 ? (
                <div className="flex justify-between text-primary">
                  <span>FIRST10 discount</span>
                  <span>-{dollars(selection.discountCents)}</span>
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex items-end justify-between">
              <span className="font-medium text-slate-700">Total</span>
              <span className="text-3xl font-bold text-slate-950">
                {dollars(selection.finalTotalCents)}
              </span>
            </div>
            {error ? (
              <p role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={sendOrder}
              disabled={sending}
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send order to TAKATAK"}
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              No payment is taken now. Final price is confirmed on your invoice.
            </p>
            <button
              type="button"
              onClick={onClear}
              className="mt-2 w-full rounded-lg border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Remove package
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CheckoutClient({
  upmindClientId = null,
}: {
  upmindClientId?: string | null;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<CheckoutSelection | null>(
    null,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSelection(readCheckoutSelection());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (selection) {
    return (
      <MarketplaceOrder
        selection={selection}
        onClear={() => {
          clearCheckoutSelection();
          setSelection(null);
        }}
        onSent={() => clearCheckoutSelection()}
      />
    );
  }

  return (
    <div>
      <div
        className={`flex items-center gap-[30px] bg-white text-black ${styles.pagetop}`}
      >
        <button
          type="button"
          className={`flex items-center gap-[10px] rounded bg-[#dfdfeb] ${styles.butn}`}
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
              return;
            }
            router.push("/domain");
          }}
        >
          <IoArrowBack />
          Back
        </button>
        <p className="font-semibold">
          Checkout: Get Started With Your Domain & Hosting Journey
        </p>
      </div>

      <section className="flex flex-col items-center justify-center bg-[#090a1a] py-[70px]">
        <div className="flex flex-col items-center justify-center gap-[40px] text-white">
          <h1 className="w-[90vw] text-center text-[30px] font-[700] lg:w-[45vw] lg:text-[34px]">
            Power Your Online Success{" "}
            <span className="font-medium">with the Perfect Domain.</span>
          </h1>
        </div>
        <div className="w-full">
          <DomainSearchDesk clientId={upmindClientId} />
        </div>
        {!upmindClientId ? (
          <p className="mt-4 px-6 text-center text-xs text-white/70">
            Search works. If Upmind asks you to create an account, refresh this
            page so TAKATAK can attach your customer.
          </p>
        ) : null}
      </section>

      <section
        id="checkout-hosting"
        className="flex scroll-mt-24 flex-col items-center justify-center gap-[30px] bg-white px-6 py-[70px] text-black"
      >
        <div className="flex flex-col items-center gap-[15px]">
          <h2 className="text-center text-[33px]">
            Pick a plan and
            <span className="font-bold"> supercharge your WordPress.</span>
          </h2>
          <p className="w-[85vw] text-center text-[19px] font-semibold lg:w-[49vw]">
            Order your go-to setup, or explore a bold new option. Our TAKATAK
            WordPress hosting plans are built to match any project — including
            yours.
          </p>
        </div>
        <div className="w-full max-w-6xl">
          <UpmindHostingPlans clientId={upmindClientId} />
        </div>
      </section>

      <CheckoutScrollArrow downTargetId="checkout-hosting" />
    </div>
  );
}
