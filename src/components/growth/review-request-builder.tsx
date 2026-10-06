"use client";

import { useMemo, useState } from "react";

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function ReviewRequestBuilder() {
  const [business, setBusiness] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [customer, setCustomer] = useState("");

  const trimmedPlaceId = placeId.trim();
  const placeIdValid = PLACE_ID_PATTERN.test(trimmedPlaceId);
  const reviewUrl = placeIdValid
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(trimmedPlaceId)}`
    : "";

  const templates = useMemo(() => {
    const name = business.trim() || "our team";
    const hi = customer.trim() ? `Hi ${customer.trim()}, ` : "Hi, ";
    const link = reviewUrl || "[review link]";
    return {
      sms: `${hi}thanks for choosing ${name}! Would you take 30 seconds to leave us a Google review? ${link}`,
      whatsapp: `${hi}thank you for choosing ${name} 🙏 Your feedback helps a local business grow. Could you leave us a quick Google review? ${link}`,
      emailSubject: `How did we do, ${customer.trim() || "friend"}?`,
      emailBody: `${hi}\n\nThank you for choosing ${name}. If you have a moment, we'd really appreciate a short Google review:\n\n${link}\n\nIf anything wasn't perfect, just reply to this email — we read every message and will make it right.\n\n— ${name}`,
    };
  }, [business, customer, reviewUrl]);

  const inputClass =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Business name
          <input className={inputClass} value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Garage Verdun" maxLength={80} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Google Place ID
          <input className={inputClass} value={placeId} onChange={(e) => setPlaceId(e.target.value)} placeholder="ChIJ…" maxLength={200} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Customer first name (optional)
          <input className={inputClass} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Marie" maxLength={40} />
        </label>
      </div>
      <p className="text-[11px] text-slate-500">
        Find a Place ID with Google&apos;s{" "}
        <a
          href="https://developers.google.com/maps/documentation/places/web-service/place-id"
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-indigo-600 hover:text-indigo-800"
        >
          Place ID Finder ↗
        </a>
        . Nothing typed here is saved or sent anywhere.
      </p>

      {trimmedPlaceId && !placeIdValid ? (
        <p className="text-xs text-rose-700">That Place ID does not look right. It usually starts with “ChIJ”.</p>
      ) : null}

      {reviewUrl ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-emerald-900">{reviewUrl}</span>
          <CopyButton value={reviewUrl} label="Copy link" />
          <a href={reviewUrl} target="_blank" rel="noreferrer noopener" className="text-xs font-medium text-emerald-800 hover:underline">
            Test ↗
          </a>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-800">SMS</p>
            <CopyButton value={templates.sms} />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{templates.sms}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800">WhatsApp</p>
            <div className="flex gap-2">
              <CopyButton value={templates.whatsapp} />
              <a
                href={`https://wa.me/?text=${encodeURIComponent(templates.whatsapp)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Send
              </a>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{templates.whatsapp}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800">Email</p>
            <div className="flex gap-2">
              <CopyButton value={`${templates.emailSubject}\n\n${templates.emailBody}`} />
              <a
                href={`mailto:?subject=${encodeURIComponent(templates.emailSubject)}&body=${encodeURIComponent(templates.emailBody)}`}
                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Open
              </a>
            </div>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-700">{templates.emailSubject}</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{templates.emailBody}</p>
        </div>
      </div>
    </div>
  );
}
