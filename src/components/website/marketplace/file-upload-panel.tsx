"use client";

import {
  useState,
} from "react";
import {
  File,
  Upload,
  X,
} from "lucide-react";

export function FileUploadPanel() {
  const [files, setFiles] =
    useState<File[]>([]);

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <label className="flex cursor-pointer flex-col items-center justify-center py-4 text-center">
        <Upload
          size={22}
          className="text-emerald-700"
        />

        <span className="mt-2 text-sm font-medium text-slate-700">
          Select reference files
        </span>

        <span className="mt-1 text-xs text-slate-500">
          The files remain on this device until
          the project workspace is created.
        </span>

        <input
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            setFiles(
              Array.from(
                event.target.files ?? [],
              ),
            );
          }}
        />
      </label>

      {files.length > 0 ? (
        <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          {files.map(
            (fileItem, index) => (
              <li
                key={`${fileItem.name}-${fileItem.size}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs"
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-slate-700">
                  <File
                    size={13}
                    className="shrink-0"
                  />

                  <span className="truncate">
                    {fileItem.name}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setFiles(
                      (current) =>
                        current.filter(
                          (_, fileIndex) =>
                            fileIndex !==
                            index,
                        ),
                    )
                  }
                  aria-label={`Remove ${fileItem.name}`}
                  className="text-slate-400 transition hover:text-slate-950"
                >
                  <X size={14} />
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  );
}