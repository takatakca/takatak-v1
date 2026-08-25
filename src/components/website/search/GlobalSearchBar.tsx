"use client";

import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@/lib/website/nav";
import { Search } from "lucide-react";
import { localSearch, type SearchEntry } from "@/lib/website/search-catalog";
import { MARKETPLACE_CATEGORIES } from "@/lib/website/marketplace-categories";

export function GlobalSearchBar() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchEntry[]>([]);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResults(localSearch(q, category || undefined));
  }, [q, category]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = () => {
    setOpen(false);
    void navigate({ to: "/search", search: { q, category } as never });
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 pl-3 pr-1 py-1 focus-within:ring-2 focus-within:ring-primary/30">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Search domains, services, freelancers…"
          className="flex-1 bg-transparent outline-none text-sm py-1 min-w-0"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="hidden md:block text-xs bg-transparent border-l border-border px-2 py-1 outline-none max-w-[110px]"
          aria-label="Category"
        >
          <option value="">All</option>
          {MARKETPLACE_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden max-h-96 overflow-y-auto">
          {results.map((r) => (
            <Link
              key={r.id}
              to={r.to}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-secondary/50 border-b border-border/40 last:border-0"
            >
              <span className="truncate">{r.title}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{r.kind.replace("_", " ")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}