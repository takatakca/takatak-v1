"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Upload, Mail, ClipboardList } from "lucide-react";
import { importReviewedReviewsAction } from "@/app/dashboard/growth/reviews/import-actions";
import {
  IMPORTABLE_REVIEW_SOURCES,
  parseReviewCSV,
  parseReviewImport,
  type ReviewImportResult,
} from "@/lib/reputation/import-model";
import { reviewSource } from "@/lib/reputation/sources";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type ImportLocations = Array<{
  id: string;
  name: string;
  city: string | null;
  platformName: string;
}>;
const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600";

function CommitImport({
  preview,
}: {
  preview: Extract<ReviewImportResult, { ok: true }>;
}) {
  const [state, action, pending] = useActionState(importReviewedReviewsAction, {
    ok: null,
  });
  return (
    <form
      action={action}
      aria-busy={pending}
      className="mt-4 space-y-3 border-t border-slate-200 pt-4"
    >
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({
          listingId: preview.listingId,
          provenance: preview.provenance,
          rows: preview.rows,
        })}
      />
      <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
        <input
          type="checkbox"
          name="confirmed"
          required
          disabled={pending || state.ok === true}
          className="mt-1"
        />
        I am authorized to store these reviews for this business. I checked the
        source and removed unrelated personal information.
      </label>
      <button
        type="submit"
        disabled={pending || state.ok === true}
        className="rounded-lg bg-[#1565D8] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending
          ? "Saving…"
          : state.ok === true
            ? "Import saved"
            : `Save ${preview.rows.length} reviewed record${preview.rows.length === 1 ? "" : "s"}`}
      </button>
      {state.ok === true && (
        <p role="status" className="text-sm text-emerald-800">
          {state.created} saved · {state.skipped} already present. Records
          appear in the inbox as operator imports, excluded from verified-source
          rating averages. No public reply was sent.
        </p>
      )}
      {state.ok === false && (
        <p role="alert" className="text-sm text-rose-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function ReviewImportWorkspace({
  locations,
}: {
  locations: ImportLocations;
}) {
  const [mode, setMode] = useState<"manual" | "email" | "csv">("manual");
  const [preview, setPreview] = useState<ReviewImportResult | null>(null);
  const [csv, setCSV] = useState("");
  const [fileError, setFileError] = useState("");
  const [source, setSource] = useState("google");
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let rows: unknown[];
    if (mode === "csv") {
      const parsed = parseReviewCSV(csv);
      if (!parsed.ok) {
        setPreview(parsed);
        return;
      }
      rows = parsed.rows;
    } else {
      const date = String(form.get("reviewedAt") || "");
      const rating = String(form.get("rating") || "");
      rows = [
        {
          source,
          externalId: String(form.get("externalId") || ""),
          author: String(form.get("author") || ""),
          text: String(form.get("text") || ""),
          rating: rating ? Number(rating) : null,
          reviewedAt: date ? `${date}T12:00:00.000Z` : "",
          url: String(form.get("url") || ""),
        },
      ];
    }
    setPreview(
      parseReviewImport({
        listingId: form.get("listingId"),
        provenance: mode,
        rows,
      }),
    );
  }
  return (
    <Card>
      <section aria-label="Review import workspace">
        <CardHeader
          title="Bring your reviews into TAKATAK"
          subtitle="Review an email notification, record a source review, or import an authorized CSV export."
        />
        <CardBody>
          <div
            role="group"
            aria-label="Import method"
            className="flex flex-wrap gap-2"
          >
            {[
              { id: "manual", label: "Add a review", icon: ClipboardList },
              { id: "email", label: "From an email", icon: Mail },
              { id: "csv", label: "CSV import", icon: Upload },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => {
                  setMode(id as typeof mode);
                  setPreview(null);
                  setFileError("");
                }}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${mode === id ? "border-[#1565D8] bg-blue-50 text-[#1565D8]" : "border-slate-200 text-slate-600"}`}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-500">
            {mode === "email"
              ? "Copy only the review fields from a notification you are authorized to use. Do not paste an entire email, mailbox, password or private conversation. This records the review; it does not connect your mailbox."
              : "Imports are operator records, not a live API connection. They retain their source and cannot publish replies automatically."}
          </p>
          {!locations.length ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Create an active business listing in Local Listings before
              importing reviews. Demo, planned and archived listings cannot
              receive imports.
            </p>
          ) : (
            <>
              <form
                onSubmit={prepare}
                onChange={() => setPreview(null)}
                className="mt-4 space-y-4"
              >
                <label className="block text-xs font-medium text-slate-700">
                  Destination business listing
                  <select name="listingId" required className={inputClass}>
                    <option value="">Choose a listing…</option>
                    {locations.map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {listing.name}
                        {listing.city ? ` · ${listing.city}` : ""} ·{" "}
                        {listing.platformName} · {listing.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
                {mode === "csv" ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-slate-700">
                      CSV file (up to 50 reviews, 128 KB)
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className={inputClass}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          setPreview(null);
                          setFileError("");
                          setCSV("");
                          if (!file) return;
                          if (file.size > 128 * 1024) {
                            setFileError("CSV must be smaller than 128 KB.");
                            return;
                          }
                          try {
                            setCSV(await file.text());
                          } catch {
                            setFileError("This file could not be read.");
                          }
                        }}
                      />
                    </label>
                    <p className="break-words text-xs leading-6 text-slate-500">
                      Required columns: source, externalId, text, reviewedAt
                      (ISO date/time). Optional: author, rating, url. Quoted
                      commas and multiline comments are supported. Reuse source
                      IDs to prevent duplicates.
                    </p>
                    <a
                      href="data:text/csv;charset=utf-8,source%2CexternalId%2Cauthor%2Ctext%2Crating%2CreviewedAt%2Curl%0A"
                      download="takatak-review-import-template.csv"
                      className="text-xs font-semibold text-[#1565D8]"
                    >
                      Download blank CSV template
                    </a>
                    {fileError && (
                      <p role="alert" className="text-xs text-rose-700">
                        {fileError}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-xs font-medium text-slate-700">
                        Review platform
                        <select
                          name="source"
                          value={source}
                          onChange={(event) => setSource(event.target.value)}
                          className={inputClass}
                        >
                          {IMPORTABLE_REVIEW_SOURCES.map((id) => (
                            <option key={id} value={id}>
                              {reviewSource(id)?.name || id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Source review ID
                        <input
                          name="externalId"
                          required
                          maxLength={256}
                          className={inputClass}
                          placeholder="Stable ID from the source or your export"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Reviewer display name
                        <input
                          name="author"
                          maxLength={120}
                          className={inputClass}
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Review date
                        <input
                          name="reviewedAt"
                          type="date"
                          required
                          className={inputClass}
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Star rating
                        <select
                          name="rating"
                          disabled={source === "facebook"}
                          className={inputClass}
                        >
                          <option value="">Not star-rated</option>
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>
                              {rating} stars
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Source review link (optional)
                        <input
                          name="url"
                          type="url"
                          maxLength={2048}
                          className={inputClass}
                          placeholder="https://…"
                        />
                      </label>
                    </div>
                    <label className="block text-xs font-medium text-slate-700">
                      Review text
                      <textarea
                        name="text"
                        required
                        rows={4}
                        maxLength={5000}
                        className={inputClass}
                      />
                    </label>
                  </>
                )}
                <button
                  type="submit"
                  disabled={mode === "csv" && (!csv || !!fileError)}
                  className="rounded-lg border border-[#1565D8] px-4 py-2 text-sm font-semibold text-[#1565D8] disabled:opacity-50"
                >
                  Preview import
                </button>
              </form>
              {preview && !preview.ok && (
                <p role="alert" className="mt-4 text-sm text-rose-700">
                  {preview.error}
                </p>
              )}
              {preview?.ok && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Review before saving · {preview.rows.length} records
                  </h3>
                  <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto">
                    {preview.rows.map((row, index) => (
                      <li
                        key={`${row.source}-${row.externalId}-${index}`}
                        className="rounded-lg border border-slate-200 bg-white p-3 text-xs"
                      >
                        <p className="font-semibold text-slate-900">
                          {reviewSource(row.source)?.name} ·{" "}
                          {row.author || "Customer"} ·{" "}
                          {row.rating === null
                            ? "Not star-rated"
                            : `${row.rating}/5`}
                        </p>
                        <p className="mt-1 text-slate-500">
                          {row.reviewedAt.slice(0, 10)} · {row.externalId}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap break-words leading-5 text-slate-700">
                          {row.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <CommitImport
                    key={JSON.stringify(preview)}
                    preview={preview}
                  />
                </div>
              )}
            </>
          )}
        </CardBody>
      </section>
    </Card>
  );
}
