"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { setActiveBrand } from "@/app/dashboard/brand-actions";
import type { BrandSessionOption } from "@/lib/security/brand-context";

export function BrandSwitcher({
  activeBrandId,
  brands,
}: {
  activeBrandId: string | null;
  brands: BrandSessionOption[];
}) {
  const pathname = usePathname();

  const formRef =
    useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={setActiveBrand}
      className="w-full"
    >
      <input
        type="hidden"
        name="next"
        value={pathname}
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">
          Active brand
        </span>

        <span className="relative block">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <select
            name="brandId"
            defaultValue={
              activeBrandId ?? ""
            }
            onChange={() =>
              formRef.current?.requestSubmit()
            }
            disabled={
              brands.length === 0
            }
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {brands.length === 0
                ? "No brands available"
                : "All brands"}
            </option>

            {brands.map((brand) => (
              <option
                key={brand.id}
                value={brand.id}
              >
                {brand.name}
                {brand.status !== "active"
                  ? ` — ${brand.status}`
                  : ""}
              </option>
            ))}
          </select>
        </span>
      </label>
    </form>
  );
}