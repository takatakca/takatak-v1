import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ACTIVITY_FEED } from "@/lib/dashboard/dashboard-config";

export function ActivityFeed() {
  return (
    <Card>
      <CardHeader title="Activity" subtitle="Foundation activity — real events arrive with the jobs system." />
      <CardBody>
        <ol className="space-y-4">
          {ACTIVITY_FEED.map((item, i) => (
            <li key={item.message} className="relative flex gap-3">
              <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500/80" />
                {i < ACTIVITY_FEED.length - 1 ? (
                  <span className="absolute left-1/2 top-3 h-8 w-px -translate-x-1/2 bg-slate-200" />
                ) : null}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{item.message}</p>
                {item.detail ? <p className="text-[11px] text-slate-400">{item.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
