"use client";

import { useState, type ReactNode } from "react";

import { ColumnsMenu, downloadCsv } from "@/components/social/platforms/instagram-live-panels";
import { toCsv } from "@/lib/social/instagram-live-stats";

/**
 * Columns menu and CSV download sharing one state: the columns chosen are the
 * columns exported. Used by the network tables that have no rows yet, so the
 * file holds the header the table will fill.
 */
export function CsvColumnsControls({
  filename,
  columns,
  rows = [],
  icon,
  badge,
}: {
  filename: string;
  columns: string[];
  rows?: Array<Array<string | number | null>>;
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  const [visible, setVisible] = useState<Set<string>>(() => new Set(columns));
  const toggle = (key: string) =>
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const chosen = columns.map((key, index) => ({ key, index })).filter((column) => visible.has(column.key));
  return (
    <>
      <ColumnsMenu
        label="Columns"
        columns={columns.map((key, index) => ({ key, label: key.replace(/_/g, " "), required: index === 0 }))}
        visible={visible}
        onToggle={toggle}
      />
      <button
        type="button"
        onClick={() =>
          downloadCsv(
            filename,
            toCsv(
              chosen.map((column) => column.key),
              rows.map((row) => chosen.map((column) => row[column.index] ?? null)),
            ),
          )
        }
        className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
      >
        {icon}
        Download CSV
        {badge}
      </button>
    </>
  );
}
