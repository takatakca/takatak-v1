"use client";

import { useState } from "react";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function WhatsAppButtonBuilder() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Hi! I have a question about your services.");
  const [copied, setCopied] = useState(false);

  const digits = digitsOnly(phone);
  const valid = digits.length >= 10 && digits.length <= 15;
  const link = valid ? `https://wa.me/${digits}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ""}` : "";
  const snippet = valid
    ? `<a href="${link}" target="_blank" rel="noopener" style="position:fixed;right:20px;bottom:20px;z-index:9999;background:#25D366;color:#fff;font:600 15px/1 system-ui,sans-serif;padding:14px 18px;border-radius:999px;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.2)">💬 WhatsApp</a>`
    : "";

  const inputClass =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Business WhatsApp number (with country code)
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 514 555 0123" inputMode="tel" maxLength={24} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Pre-filled message
          <input className={inputClass} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} />
        </label>
      </div>
      {phone && !valid ? <p className="text-xs text-rose-700">Enter 10–15 digits including the country code (1 for Canada/US).</p> : null}
      {valid ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <a href={link} target="_blank" rel="noreferrer noopener" className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white">
              💬 WhatsApp (preview)
            </a>
            <span className="truncate font-mono text-xs text-slate-500">{link}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-800">Paste before &lt;/body&gt; on the client website</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(snippet);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300"
              >
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-4 text-slate-600">{snippet}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
