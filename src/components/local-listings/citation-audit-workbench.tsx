"use client";

import { useMemo, useState } from "react";
import {
  auditCitations, exportCitationAuditCsv, parseCitationCsv,
  type BusinessNap, type CitationReferenceProfile, type FieldFinding,
} from "@/lib/local-listings/citation-audit";
import {
  citationEvidenceMatchesProfile, type SavedCitationEvidence,
} from "@/lib/local-listings/citation-evidence";

const EMPTY: BusinessNap = { name: "", address: "", phone: "", website: "" };
const FIELDS = ["name", "address", "phone", "website"] as const;
const FIELD_NAMES: Record<(typeof FIELDS)[number], string> = {
  name: "Business name", address: "Full street address", phone: "Phone number", website: "Website",
};
const CHECK_LABEL: Record<FieldFinding, string> = {
  match: "Matches", mismatch: "Different", missing_in_citation: "Not supplied", reference_missing: "No reference",
};

export function CitationAuditWorkbench({
  profiles, savedEvidence,
}: {
  profiles: CitationReferenceProfile[];
  savedEvidence: SavedCitationEvidence[];
}) {
  const [reference, setReference] = useState<BusinessNap>(EMPTY);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [csv, setCsv] = useState("");
  const [evidenceMode, setEvidenceMode] = useState<"csv" | "saved">("csv");
  const [fileError, setFileError] = useState("");
  const parsed = useMemo(() => {
    try { return { data: parseCitationCsv(csv), error: "" }; }
    catch (error) { return { data: { rows: [], warnings: [] }, error: error instanceof Error ? error.message : "Invalid CSV" }; }
  }, [csv]);
  const selected = profiles.find(profile => profile.id === selectedProfile);
  const linkedEvidence = useMemo(() => selected
    ? savedEvidence.filter(item => citationEvidenceMatchesProfile(selected, item)) : [],
    [selected, savedEvidence]);
  const comparisonRows = evidenceMode === "saved"
    ? linkedEvidence.map(item => item.row) : parsed.data.rows;
  const results = useMemo(
    () => auditCitations(reference, comparisonRows),
    [reference, comparisonRows],
  );
  const ready = FIELDS.some(f => reference[f].trim()) &&
    results.summary.total > 0 && (evidenceMode === "saved" || !parsed.error);
  const hasEnoughReference = FIELDS.every(f => reference[f].trim());

  function exportReport() {
    if (!ready) return;
    const csvText = exportCitationAuditCsv(results.findings);
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "takatak-local-citation-audit.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function loadFile(file: File | undefined) {
    setFileError("");
    if (!file) return;
    if (file.size > 250_000) { setFileError("Maximum CSV size is 250 KB."); return; }
    try { setCsv(await file.text()); setEvidenceMode("csv"); }
    catch { setFileError("Could not read this file."); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <strong>Private evidence check — not an online directory scanner.</strong>
        <p className="mt-1">Compare your own CSV or saved TAKATAK citations and connected Google snapshots against the reference details. No fresh publisher API requests are made, no listings are changed, and manually entered CSV data stays in the browser.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="business-reference-title">
        <h2 id="business-reference-title" className="text-lg font-semibold text-slate-900">1. Official business details</h2>
        <p className="mb-4 text-sm text-slate-500">Use your full NAP details as the source of truth. Fields left blank cannot be validated.</p>
        {profiles.length > 0 && <label className="mb-4 block text-sm font-medium text-slate-800">
          Start with a saved workspace business profile
          <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={selectedProfile}
            onChange={event => {
              setSelectedProfile(event.target.value);
              const match = profiles.find(item => item.id === event.target.value);
              if (match) setReference({ ...match.nap });
            }}>
            <option value="">Enter information manually</option>
            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">Profiles are previously stored TAKATAK or connected Google snapshots, not newly verified live publisher data.</span>
        </label>}
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(field => (
            <label key={field} className="block text-sm font-medium text-slate-800">
              {FIELD_NAMES[field]}
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                autoComplete="off"
                value={reference[field]}
                maxLength={500}
                placeholder={field === "phone" ? "+1 514 555 0100" : field === "website" ? "https://example.ca" : ""}
                onChange={event => setReference(previous => ({ ...previous, [field]: event.target.value }))}
              />
            </label>
          ))}
        </div>
        {!hasEnoughReference && <p className="mt-3 text-xs text-amber-800">For a complete comparison, fill in all four reference fields.</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="evidence-title">
        <h2 id="evidence-title" className="text-lg font-semibold text-slate-900">2. Import citation evidence</h2>
        <p className="mb-3 text-sm text-slate-500">Choose saved records from this business/location or compare your own CSV. Saved records are historical evidence, not live directory verification.</p>
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEvidenceMode("csv")}
            aria-pressed={evidenceMode === "csv"}
            className={evidenceMode === "csv" ? "rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white" : "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"}>
            My CSV evidence
          </button>
          <button type="button" onClick={() => setEvidenceMode("saved")}
            disabled={!selected || linkedEvidence.length === 0}
            aria-pressed={evidenceMode === "saved"}
            className={evidenceMode === "saved" ? "rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white" : "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"}>
            Linked saved evidence ({linkedEvidence.length})
          </button>
        </div>
        {evidenceMode === "saved" && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p>Using {linkedEvidence.length} saved citation or Google Business snapshot record(s). Unverified or missing NAP fields will be marked as needing verification.</p>
            <ul className="mt-2 space-y-1">
              {linkedEvidence.slice(0, 10).map(item => (
                <li key={item.id}>{item.row.directory} — {item.sourceLabel}
                  {item.observedAt ? " (saved " + item.observedAt.slice(0, 10) + ")" : " (date unknown)"}</li>
              ))}
              {linkedEvidence.length > 10 && <li>And {linkedEvidence.length - 10} more saved records.</li>}
            </ul>
          </div>
        )}
        <p className="mb-3 text-xs text-slate-500">CSV column headers: directory, name, address, phone, website, listing_url. Up to 500 records, 250 KB. Values may be quoted and contain commas.</p>
        <label className="mb-3 block text-sm font-medium text-slate-800">
          Select a local CSV file
          <input className="mt-1 block w-full text-sm" type="file" accept=".csv,text/csv" onChange={event => void loadFile(event.target.files?.[0])} />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Or paste CSV
          <textarea className="mt-1 min-h-36 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs text-slate-900"
            spellCheck={false} value={csv} onChange={event => { setCsv(event.target.value); setEvidenceMode("csv"); }}
            placeholder={"directory,name,address,phone,website,listing_url\nExample Directory,My Business,123 Main St,+1 514 555 0100,https://example.ca,https://directory.example/my-business"}
          />
        </label>
        {(fileError || (evidenceMode === "csv" && parsed.error)) && <p role="alert" className="mt-2 text-sm text-red-700">{fileError || parsed.error}</p>}
        {evidenceMode === "csv" && parsed.data.warnings.length > 0 && <ul className="mt-2 text-sm text-amber-800">
          {parsed.data.warnings.slice(0, 5).map((warning, index) => <li key={index}>{warning}</li>)}
        </ul>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="findings-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="findings-title" className="text-lg font-semibold text-slate-900">3. Citation findings</h2>
            <p className="text-xs text-slate-500">“Consistent” means a match against selected stored or CSV evidence only; it does not verify current publisher data.</p>
          </div>
          <button disabled={!ready} type="button" onClick={exportReport}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            Export correction CSV
          </button>
        </div>
        <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Rows", results.summary.total],
            ["Consistent in evidence", ready ? results.summary.consistent : 0],
            ["Needs update", ready ? results.summary.needsUpdate : 0],
            ["Needs verification", ready ? results.summary.needsVerification : 0],
            ["Possible duplicates", ready ? results.summary.duplicates : 0],
          ].map(([label, number]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xl font-bold text-slate-900">{number}</p>
              <p className="text-xs text-slate-600">{label}</p>
            </div>
          ))}
        </div>
        {!ready ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Select a saved business with linked citation evidence or import your own CSV, and enter official business details to compare.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr><th className="p-2">Directory</th><th className="p-2">Result</th>
                  {FIELDS.map(field => <th className="p-2" key={field}>{FIELD_NAMES[field]}</th>)}
                </tr>
              </thead>
              <tbody>
                {results.findings.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="p-2 font-medium text-slate-900">
                      {item.directory}
                      {item.listingUrl && <a className="block break-all text-xs text-blue-700 underline" href={item.listingUrl} target="_blank" rel="noreferrer noopener">View supplied link</a>}
                      {item.duplicate && <span className="block text-xs text-amber-700">Possible duplicate</span>}
                    </td>
                    <td className="p-2">{item.status === "needs_update" ? "Needs update" : item.status === "needs_verification" ? "Needs verification" : "Consistent in supplied evidence"}</td>
                    {FIELDS.map(field => <td key={field} className="p-2">
                      <span className={item.fields[field] === "mismatch" ? "font-medium text-red-700" : item.fields[field] === "match" ? "text-green-700" : "text-slate-500"}>
                        {CHECK_LABEL[item.fields[field]]}
                      </span>
                    </td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
