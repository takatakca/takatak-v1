import type { ActivityEvent } from "@/lib/data/types";

const KIND_COLORS: Record<string, string> = {
  architecture: "bg-indigo-500",
  build: "bg-violet-500",
  integration: "bg-amber-500",
  documentation: "bg-slate-400",
  verification: "bg-emerald-500",
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <ol className="space-y-5">
      {events.map((event, i) => (
        <li key={event.id} className="relative flex gap-3">
          <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
            <span className={`h-2.5 w-2.5 rounded-full ${KIND_COLORS[event.kind] ?? "bg-slate-400"}`} />
            {i < events.length - 1 ? (
              <span className="absolute left-1/2 top-3 h-10 w-px -translate-x-1/2 bg-slate-200" />
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{event.message}</p>
            {event.detail ? <p className="text-[11px] text-slate-400">{event.detail}</p> : null}
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">{event.phase}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
