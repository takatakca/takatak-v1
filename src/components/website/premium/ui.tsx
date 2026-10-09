"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowRight, Clock3, Headset, Sparkle } from "lucide-react";

import { Link } from "@/lib/website/nav";
import { openLiveChat } from "@/lib/website/chat-provider";
import type { Language, TranslationKey } from "@/lib/website/i18n";
import type { Cadence } from "@/lib/website/pricing";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import type {
  Availability,
  CategoryCta,
  CoreCategory,
} from "@/lib/website/core-categories";

/** Translation helper for the dynamic `cat.*` / `mock.*` keys. */
export function useCopy() {
  const { t, lang } = useLanguage();
  const tk = useCallback(
    (key: string, vars?: Record<string, string | number>) => t(key as TranslationKey, vars),
    [t],
  );
  return { tk, lang };
}

/** CAD amounts: "$19.99" in English, "19,99 $" in French. */
export function money(lang: Language, amount: number): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: amount % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

const CADENCE_KEY: Record<Cadence, string> = {
  monthly: "cadence.monthly",
  yearly: "cadence.yearly",
  "per-lead": "cadence.perLead",
  "one-time": "cadence.oneTime",
  custom: "cadence.custom",
};

export function cadenceSuffix(tk: (k: string) => string, cadence: Cadence): string {
  return tk(CADENCE_KEY[cadence]);
}

export function accentStyle(category: Pick<CoreCategory, "accent" | "accent2">): CSSProperties {
  return { "--tk-accent": category.accent, "--tk-accent-2": category.accent2 } as CSSProperties;
}

/** Homepage "from" line for a category. */
export function FromLine({ category, className = "" }: { category: CoreCategory; className?: string }) {
  const { tk, lang } = useCopy();
  if (category.from === "quote") {
    return <span className={className}>{tk("cat.onQuote")}</span>;
  }
  if (category.from === "planned") {
    return <span className={className}>{tk("cat.planned")}</span>;
  }
  return (
    <span className={className}>
      <span className="text-[var(--tk-silver)]">{tk(category.from.prefixKey)} </span>
      <span className="font-bold text-white">{money(lang, category.from.amount)}</span>
      <span className="text-[var(--tk-silver)]">{cadenceSuffix(tk, category.from.cadence)}</span>
    </span>
  );
}

const AVAIL_STYLE: Record<Availability, string> = {
  live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  early: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  onRequest: "border-white/20 bg-white/[0.06] text-white/85",
  planned: "border-amber-300/35 bg-amber-300/10 text-amber-100",
};

/** Availability status. Green/amber here are status colours (BRAND.md). */
export function AvailabilityBadge({ availability, className = "" }: { availability: Availability; className?: string }) {
  const { tk } = useCopy();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${AVAIL_STYLE[availability]} ${className}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          availability === "live" ? "bg-emerald-300" : availability === "planned" ? "bg-amber-300" : "bg-sky-200"
        }`}
      />
      {tk(`cat.avail.${availability}`)}
    </span>
  );
}

export function SoonTag({ className = "" }: { className?: string }) {
  const { tk } = useCopy();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100 ${className}`}
    >
      <Clock3 size={10} aria-hidden /> {tk("cat.soon")}
    </span>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tk-cyan)] ${className}`}>
      {children}
    </p>
  );
}

export function CategoryIcon({ category, size = 44 }: { category: CoreCategory; size?: number }) {
  const Icon = category.icon;
  return (
    <span
      aria-hidden
      className="tk-accent-bg relative grid shrink-0 place-items-center rounded-2xl text-white shadow-[0_12px_30px_-12px_var(--tk-accent)]"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgb(255_255_255/0.28),transparent_55%)]" />
      <Icon size={Math.round(size * 0.46)} className="relative" />
    </span>
  );
}

/** Small "Illustration" caption for in-code product mock-ups. */
export function IllustrationTag({ className = "" }: { className?: string }) {
  const { tk } = useCopy();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/70 backdrop-blur ${className}`}
    >
      <Sparkle size={9} aria-hidden /> {tk("cat.common.illustration")}
    </span>
  );
}

/** A call to action: a link, the live chat, or a custom handler. */
export function CtaButton({
  cta,
  variant = "primary",
  onDomainSearch,
  page,
  className = "",
}: {
  cta: CategoryCta;
  variant?: "primary" | "ghost";
  onDomainSearch?: () => void;
  page?: string;
  className?: string;
}) {
  const { tk, lang } = useCopy();
  const base = `inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tk-navy)] ${
    variant === "primary" ? "tk-btn-primary" : "tk-btn-ghost"
  } ${className}`;
  if (cta.action === "chat") {
    return (
      <button
        type="button"
        className={base}
        onClick={() => openLiveChat({ page: page ?? "/", intent: cta.labelKey, lang })}
      >
        <Headset size={16} aria-hidden /> {tk(cta.labelKey)}
      </button>
    );
  }
  if (cta.action === "domainSearch" && onDomainSearch) {
    return (
      <button type="button" className={base} onClick={onDomainSearch}>
        {tk(cta.labelKey)} <ArrowRight size={16} aria-hidden />
      </button>
    );
  }
  return (
    <Link to={cta.to} className={base}>
      {tk(cta.labelKey)} <ArrowRight size={16} aria-hidden />
    </Link>
  );
}

/** Segmented control: tabs that switch a view, with arrow-key support. */
export function SegmentedTabs({
  items,
  value,
  onChange,
  idBase,
  label,
  className = "",
}: {
  items: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  idBase: string;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`tk-seg inline-flex rounded-full p-1 ${className}`}>
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKey(e, index)}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-white/65 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)] sm:text-[13px]"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Counts up to a real number from the code when it scrolls into view. */
export function CountUp({
  value,
  format,
  className = "",
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || typeof IntersectionObserver === "undefined") return;
    let frame = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (done.current || !entries.some((e) => e.isIntersecting)) return;
        done.current = true;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / 1200);
          const eased = 1 - Math.pow(1 - p, 3);
          setShown(p >= 1 ? value : value * eased);
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        setShown(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, reduced]);

  const text = format ? format(shown) : String(Math.round(shown));
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {/* Reserve the final width so counting never shifts the layout. */}
      <span className="relative inline-block">
        <span className="invisible" aria-hidden>
          {format ? format(value) : String(value)}
        </span>
        <span className="absolute inset-0 text-left" aria-hidden>
          {text}
        </span>
        <span className="sr-only">{format ? format(value) : String(value)}</span>
      </span>
    </span>
  );
}

/** Ambient navy background layers for a premium section. */
export function NavyBackdrop({ dots = true, grid = false }: { dots?: boolean; grid?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="tk-ground-glow absolute inset-0" />
      {grid && <div className="tk-grid-lines absolute inset-0" />}
      {dots && <div className="tk-dot-map absolute inset-0" />}
    </div>
  );
}
