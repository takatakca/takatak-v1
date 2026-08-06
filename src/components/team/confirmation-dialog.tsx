"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  loading?: boolean;
  proceedLabel?: string;
  onCancel: () => void;
  onProceed: () => void;
};

export function ConfirmationDialog({
  open,
  title,
  description,
  loading = false,
  proceedLabel = "Proceed",
  onCancel,
  onProceed,
}: ConfirmationDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !loading
        ) {
          onCancel();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <AlertTriangle
                aria-hidden="true"
                className="h-5 w-5"
              />
            </div>

            <div>
              <h2
                id="confirmation-dialog-title"
                className="text-lg font-semibold text-slate-950"
              >
                {title}
              </h2>

              <p
                id="confirmation-dialog-description"
                className="mt-2 text-sm leading-6 text-slate-600"
              >
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close confirmation"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X
              aria-hidden="true"
              className="h-5 w-5"
            />
          </button>
        </header>

        <footer className="flex justify-end gap-3 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onProceed}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : null}

            {loading ? "Processing…" : proceedLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}