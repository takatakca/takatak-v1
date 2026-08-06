import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { QUICK_ACTIONS } from "@/lib/dashboard/dashboard-config";

export function QuickActions() {
  return (
    <Card>
      <CardHeader title="Quick Actions" subtitle="Shortcuts into modules. Some actions arrive in later phases." />
      <CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          const inner = (
            <>
              <Icon className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-medium text-slate-700">{action.label}</span>
              {action.comingSoon ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Coming soon
                </span>
              ) : null}
            </>
          );
          const cls =
            "flex flex-col items-start gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition";
          return action.href && !action.comingSoon ? (
            <Link key={action.label} href={action.href} className={`${cls} hover:border-indigo-200 hover:bg-indigo-50/40`}>
              {inner}
            </Link>
          ) : (
            <div key={action.label} className={`${cls} opacity-70`}>
              {inner}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
