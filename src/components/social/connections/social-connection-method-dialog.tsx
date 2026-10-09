'use client';

import { CircleAlert, Link2, Loader2, Unplug, X } from 'lucide-react';

type SocialConnectionMethodDialogProps = {
  open: boolean;
  platform: 'instagram' | 'threads';
  directConfigured: boolean;
  facebookConnected: boolean;
  loading?: boolean;
  onClose: () => void;
  onDirect: () => void;
  onLinkedInstagram?: () => void;
};

export function SocialConnectionMethodDialog({
  open,
  platform,
  directConfigured,
  facebookConnected,
  loading = false,
  onClose,
  onDirect,
  onLinkedInstagram,
}: SocialConnectionMethodDialogProps) {
  if (!open) {
    return null;
  }

  const isInstagram = platform === 'instagram';
  const platformLabel = isInstagram ? 'Instagram' : 'Threads';

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex animate-[takatak-social-backdrop_180ms_ease-out] items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-connection-method-title"
        aria-describedby="social-connection-method-description"
        className="w-full max-w-lg animate-[takatak-social-panel_240ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_90px_-24px_rgba(15,23,42,0.65)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#76506f]">
              TAKATAK Social
            </p>
            <h2
              id="social-connection-method-title"
              className="mt-1 text-xl font-semibold text-slate-950"
            >
              Connect {platformLabel}
            </h2>
            <p
              id="social-connection-method-description"
              className="mt-2 text-sm leading-6 text-slate-600"
            >
              {isInstagram
                ? 'Choose how this Instagram account should be connected to this brand.'
                : 'Threads uses its own secure authorization. Facebook and Instagram credentials are never reused.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close connection options"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 px-6 py-5">
          {isInstagram ? (
            <div
              className={`rounded-xl border p-4 ${
                facebookConnected
                  ? 'border-[#d7e89a] bg-[#f8fce9]'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#2a1728] shadow-sm">
                  <Link2 aria-hidden="true" className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-950">
                    Instagram linked to Facebook
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Use the professional Instagram account linked to the
                    Facebook Page selected for this brand.
                  </p>

                  {!facebookConnected ? (
                    <div className="mt-3 flex items-start gap-2 text-sm text-amber-800">
                      <CircleAlert
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />
                      <span>
                        Connect and select a Facebook Page first. TAKATAK will
                        not send you to an invalid provider page.
                      </span>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={
                      !facebookConnected || !onLinkedInstagram || loading
                    }
                    onClick={onLinkedInstagram}
                    className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#2a1728] px-4 text-sm font-medium text-[#dfff32] transition hover:bg-[#3a2237] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {isInstagram
                      ? 'Use Instagram linked to Facebook'
                      : 'Use Threads linked to Facebook'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`rounded-xl border p-4 ${
              directConfigured
                ? 'border-slate-200 bg-white'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <Unplug aria-hidden="true" className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-950">
                  Connect {platformLabel} independently
                </h3>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  Authorize this account directly. It does not depend on a
                  Facebook connection and uses separate credentials and tokens.
                </p>

                {isInstagram ? (
                  <span className="sr-only">
                    Or sign in with Instagram independently
                  </span>
                ) : (
                  <span className="sr-only">
                    Or sign in with Threads independently
                  </span>
                )}

                {!directConfigured ? (
                  <div className="mt-3 flex items-start gap-2 text-sm text-amber-800">
                    <CircleAlert
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>
                      Direct {platformLabel} authorization is not configured for
                      this TAKATAK environment. No external authorization page
                      will be opened.
                    </span>
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={!directConfigured || loading}
                  onClick={onDirect}
                  className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#1185fe] px-4 text-sm font-medium text-white transition hover:bg-[#0875e5] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Continue with {platformLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes takatak-social-backdrop {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes takatak-social-panel {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [aria-labelledby='social-connection-method-title'] {
            animation-duration: 1ms !important;
          }
        }
      `}</style>
    </div>
  );
}
