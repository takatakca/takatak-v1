import { Info } from "lucide-react";

/** Explains honestly: what is mock, what becomes live, what is not connected. */
export function FoundationNotice({
  mock,
  future,
  notConnected,
}: {
  mock: string;
  future: string;
  notConnected: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
      <div className="space-y-1 text-xs leading-relaxed text-slate-600">
        <p><span className="font-semibold text-slate-700">Mock foundation data:</span> {mock}</p>
        <p><span className="font-semibold text-slate-700">Becomes live:</span> {future}</p>
        <p><span className="font-semibold text-slate-700">Not connected yet:</span> {notConnected}</p>
      </div>
    </div>
  );
}
