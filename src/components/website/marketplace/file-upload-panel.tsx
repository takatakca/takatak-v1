"use client";

import { File, Upload, X } from "lucide-react";
import { useState } from "react";

import {
  ACCEPTED_EXTENSIONS,
  hasAcceptedExtension,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_LEAD,
} from "@/lib/website-leads/attachment-rules";

const MAX_MB = MAX_ATTACHMENT_BYTES / (1024 * 1024);

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Reference files picked by the visitor; sent with the project after it is received. */
export function FileUploadPanel({
  files,
  onChange,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  function add(selected: File[]) {
    const skipped: string[] = [];
    const next = [...files];
    for (const file of selected) {
      if (!hasAcceptedExtension(file.name)) skipped.push(`${file.name} (type not accepted)`);
      else if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) skipped.push(`${file.name} (over ${MAX_MB} MB)`);
      else if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      else if (next.length >= MAX_ATTACHMENTS_PER_LEAD) skipped.push(`${file.name} (limit of ${MAX_ATTACHMENTS_PER_LEAD} files)`);
      else next.push(file);
    }
    setNotice(skipped.length ? `Not added: ${skipped.join(", ")}.` : null);
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <label className={`flex flex-col items-center justify-center py-4 text-center ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
        <Upload size={22} className="text-emerald-700" />
        <span className="mt-2 text-sm font-medium text-slate-700">Select reference files</span>
        <span className="mt-1 text-xs text-slate-500">
          Up to {MAX_ATTACHMENTS_PER_LEAD} files, {MAX_MB} MB each: PDF, images, Word, Excel, PowerPoint or text.
          They are sent privately to TAKATAK with your project.
        </span>
        <input
          type="file"
          multiple
          disabled={disabled}
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="sr-only"
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </label>

      {notice ? <p role="alert" className="mt-2 text-xs text-amber-700">{notice}</p> : null}

      {files.length > 0 ? (
        <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          {files.map((fileItem, index) => (
            <li
              key={`${fileItem.name}-${fileItem.size}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs"
            >
              <span className="inline-flex min-w-0 items-center gap-2 text-slate-700">
                <File size={13} className="shrink-0" />
                <span className="truncate">{fileItem.name}</span>
                <span className="shrink-0 text-slate-400">{sizeLabel(fileItem.size)}</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                aria-label={`Remove ${fileItem.name}`}
                className="text-slate-400 transition hover:text-slate-950"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
