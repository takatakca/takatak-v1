"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Globe,
  Plus,
  Search,
  X,
} from "lucide-react";

export function SiteMark({
  domain,
  imageUrl,
}: {
  domain: string;
  imageUrl?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const src =
    imageUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

  if (failed) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <Globe className="h-4 w-4" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-8 w-8 shrink-0 rounded-lg bg-slate-100 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function StatusDot({
  tone,
  label,
}: {
  tone: "success" | "warning" | "muted" | "danger";
  label: string;
}) {
  const dot =
    tone === "success"
      ? "bg-emerald-500"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "danger"
          ? "bg-rose-500"
          : "bg-slate-400";
  const text =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-rose-700"
          : "text-slate-500";

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${text}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function ReadOnlySwitch({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-flex h-5 w-9 items-center rounded-full ${on ? "bg-blue-600" : "bg-slate-200"}`}
      title="Read only until the domain provider is connected"
      aria-label={on ? "On" : "Off"}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow ${on ? "translate-x-4" : "translate-x-0.5"}`}
      />
    </span>
  );
}

export function WorkspaceToolbar({
  search,
  onSearch,
  searchPlaceholder,
  status,
  onStatus,
  statusOptions,
  extraFilterLabel,
  extraFilter,
  onExtraFilter,
  extraOptions,
  addLabel,
  addHref,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  status: string;
  onStatus: (value: string) => void;
  statusOptions: { value: string; label: string }[];
  extraFilterLabel?: string;
  extraFilter?: string;
  onExtraFilter?: (value: string) => void;
  extraOptions?: { value: string; label: string }[];
  addLabel?: string;
  addHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[180px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400"
        />
      </label>
      <select
        value={status}
        onChange={(event) => onStatus(event.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {extraOptions && extraFilter != null && onExtraFilter ? (
        <select
          value={extraFilter}
          onChange={(event) => onExtraFilter(event.target.value)}
          aria-label={extraFilterLabel}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {extraOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-400"
      >
        <Filter className="h-4 w-4" />
        Filters
      </button>
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-400"
      >
        <Download className="h-4 w-4" />
        Export
      </button>
      {addLabel && addHref ? (
        <Link
          href={addHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </Link>
      ) : addLabel ? (
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white opacity-60"
          title="Available after the domain provider is connected"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

export function PagePager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  noun: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
      <p>
        {from} to {to} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-md p-1 text-slate-500 disabled:text-slate-300"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: pages }, (_, index) => index + 1)
          .slice(0, 6)
          .map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => onPage(number)}
              className={`h-7 min-w-7 rounded-md px-1.5 text-xs font-medium ${
                number === page ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {number}
            </button>
          ))}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-md p-1 text-slate-500 disabled:text-slate-300"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
        >
          {[5, 10, 20].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function SideDrawer({
  title,
  subtitle,
  badge,
  onClose,
  tabs,
  activeTab,
  onTab,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  badge: ReactNode;
  onClose: () => void;
  tabs: string[];
  activeTab: string;
  onTab: (tab: string) => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <aside
      className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl lg:top-[72px] ${
        wide ? "max-w-[560px]" : "max-w-[420px]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
            {badge}
          </div>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTab(tab)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium ${
              tab === activeTab
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled
          title="Saving requires the domain provider to be connected"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white opacity-60"
        >
          Save Changes
        </button>
      </div>
    </aside>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function TextInput({ value }: { value: string }) {
  return (
    <input
      readOnly
      value={value}
      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
    />
  );
}