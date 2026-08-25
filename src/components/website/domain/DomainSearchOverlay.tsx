"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/lib/website/nav";
import { ArrowRight, Check, Globe2, Loader2, MessageSquare, Search, X } from "lucide-react";
import { UpmindScripts } from "@/components/website/domain/upmind-scripts";
import { DomainRequestFallback } from "@/components/website/domain/DomainRequestFallback";
import { useLanguage } from "@/lib/website/use-language";
import { formatCAD } from "@/lib/website/pricing";
import { trackEvent } from "@/lib/website/service-intent";
import {
  buildCandidates,
  detectTld,
  DOMAIN_TLDS,
  sanitizeLabel,
  saveDomainQuery,
  validateLabel,
  type SupportedDomainTld,
} from "@/lib/website/domain-search-state";

type Phase = "idle" | "checking" | "results" | "fallback";

const ERROR_KEYS = {
  empty: "domainPanel.error.empty",
  tooShort: "domainPanel.error.tooShort",
  invalid: "domainPanel.error.invalid",
} as const;

/**
 * TAKATAK Domain Search panel. Uses the managed TAKATAK domain layer when it
 * is available and switches to the TAKATAK request fallback whenever the
 * live registration service cannot be reached. Customers never see provider
 * names or raw provider errors.
 */
export function DomainSearchOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [tld, setTld] = useState<SupportedDomainTld>("ca");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [layerReady, setLayerReady] = useState<boolean | null>(null);

  const label = useMemo(() => sanitizeLabel(raw), [raw]);
  const candidates = useMemo(() => buildCandidates(label, tld), [label, tld]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // If the managed domain layer never signals ready, treat it as unavailable.
  useEffect(() => {
    if (layerReady !== null) return;
    const timer = window.setTimeout(() => setLayerReady((v) => (v === null ? false : v)), 8000);
    return () => window.clearTimeout(timer);
  }, [layerReady]);

  function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const invalid = validateLabel(raw);
    if (invalid) {
      setError(t(ERROR_KEYS[invalid]));
      return;
    }
    setError(null);
    const nextTld = detectTld(raw, tld);
    setTld(nextTld);
    setPhase("checking");
    trackEvent("domain_search", { domain: `${label}.${nextTld}`, surface: "header" });
    window.setTimeout(() => {
      setSelected(`${label}.${nextTld}`);
      setPhase("results");
    }, 700);
  }

  function selectDomain(domain: string, chosenTld: SupportedDomainTld) {
    setSelected(domain);
    saveDomainQuery({ label, tld: chosenTld, domain });
  }

  function continueToCheckout() {
    if (!selected) return;
    saveDomainQuery({ label, tld, domain: selected });
    trackEvent("domain_continue", { domain: selected, live: layerReady === true });
    if (layerReady) {
      onClose();
      void navigate({ to: "/domain" });
      return;
    }
    setPhase("fallback");
  }

  return (
    <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-border bg-popover p-4 shadow-2xl sm:p-6">
      <UpmindScripts onReady={() => setLayerReady(true)} onError={() => setLayerReady(false)} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {t("domainPanel.eyebrow")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{t("domainPanel.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("domainPanel.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("domainPanel.close")}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>

      {phase !== "fallback" && (
        <>
          <form onSubmit={runSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:border-primary/60">
              <Globe2 size={16} className="shrink-0 text-primary" aria-hidden />
              <input
                ref={inputRef}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={t("domainPanel.placeholder")}
                aria-label={t("domainPanel.inputAria")}
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">.{tld}</span>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Search size={15} /> {t("domainPanel.search")}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {DOMAIN_TLDS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTld(option)}
                aria-pressed={tld === option}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  tld === option
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                .{option}
              </button>
            ))}
            <span className="ml-auto self-center text-xs text-muted-foreground">
              {t("domainPanel.from", { price: formatCAD(19.99) })}
            </span>
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          {phase === "checking" && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin text-primary" />
              {t("domainPanel.checking", { domain: `${label}.${tld}` })}
            </div>
          )}

          {phase === "results" && (
            <div className="mt-5 space-y-2">
              {candidates.map((c) => (
                <button
                  key={c.domain}
                  type="button"
                  onClick={() => selectDomain(c.domain, c.tld)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:border-primary/50 ${
                    selected === c.domain ? "border-primary/60 bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                      selected === c.domain ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Check size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{c.domain}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.primary ? t("domainPanel.yourChoice") : t("domainPanel.alternative")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-foreground">
                    {formatCAD(c.price)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{t("domainPanel.perYear")}</span>
                  </span>
                </button>
              ))}

              <p className="pt-1 text-xs text-muted-foreground">{t("domainPanel.verifyNote")}</p>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={continueToCheckout}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  {t("domainPanel.continue")} <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => { setPhase("idle"); setRaw(""); inputRef.current?.focus(); }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  {t("domainPanel.tryAnother")}
                </button>
                <button
                  type="button"
                  onClick={() => { onClose(); void navigate({ to: "/dashboard/support" }); }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  <MessageSquare size={15} /> {t("domainPanel.talk")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {phase === "fallback" && (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground">
            {t("domainPanel.fallbackNotice")}
          </p>
          <DomainRequestFallback diagnosticCode="header_domain_panel" />
        </div>
      )}
    </div>
  );
}