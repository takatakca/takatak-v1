"use client";

import { ClipboardList, Gem } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { PLATFORM_LABELS } from "@/lib/social/status";
import type {
  MyTaskItem,
  MyTasksPageData,
  MyTasksTab,
} from "@/lib/social/my-tasks-data";

const TABS: Array<{ id: MyTasksTab; label: string }> = [
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending approval" },
  { id: "rejected", label: "Rejected" },
  { id: "approved", label: "Approved" },
];

const TAB_STATUSES: Record<MyTasksTab, string[]> = {
  open: ["changes_requested"],
  pending: ["pending"],
  rejected: ["rejected"],
  approved: ["approved"],
};

const EMPTY: Record<MyTasksTab, { title: string; description: string }> = {
  open: {
    title: "Congrats! You don't have any open tasks",
    description:
      "Here you can consult all your open tasks, see their status and manage them.",
  },
  pending: {
    title: "No posts waiting for approval",
    description:
      "Posts sent for review appear here until someone on the workspace approves or rejects them.",
  },
  rejected: {
    title: "No rejected tasks",
    description: "Rejected review requests for this workspace appear here.",
  },
  approved: {
    title: "No approved tasks",
    description: "Approved posts for this workspace appear here.",
  },
};

export function MyTasksView({
  data,
  tab,
}: {
  data: MyTasksPageData;
  tab: MyTasksTab;
}) {
  const searchParams = useSearchParams();

  function tabHref(next: MyTasksTab) {
    const path =
      next === "open"
        ? "/dashboard/social/approvals"
        : `/dashboard/social/approvals?tab=${next}`;
    return withSocialPreview(path, searchParams);
  }

  if (data.source === "unavailable") {
    return (
      <section className="px-5 py-10 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900">My tasks</h1>
        <p className="mt-2 text-sm text-slate-500">{data.message}</p>
      </section>
    );
  }

  const items = data.tasks.filter((task) =>
    TAB_STATUSES[tab].includes(task.status),
  );
  const empty = EMPTY[tab];

  return (
    <div className="bg-white pb-16">
      <div className="bg-[#f5fafd] px-5 pt-5 sm:px-6">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">
          My tasks
        </h1>

        {!data.approvalsEnabled ? (
          <aside className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
                <Gem className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  Do you need a higher plan?
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Post approvals are included on Advanced plans. This workspace
                  is on {data.planName}.
                </p>
              </div>
            </div>
            <Link
              href={withSocialPreview(
                "/dashboard/social/settings?tab=billing",
                searchParams,
              )}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[#2a1728] px-4 text-sm font-semibold text-[#dfff32]"
            >
              Upgrade your plan
            </Link>
          </aside>
        ) : null}
      </div>

      <div className="px-5 sm:px-6">
        <nav
          className="mt-6 flex flex-wrap gap-7 border-b border-slate-200"
          aria-label="Task status"
        >
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Link
                key={item.id}
                href={tabHref(item.id)}
                className={`border-b-2 pb-3 text-[15px] transition ${
                  active
                    ? "border-[#1d1d1f] font-semibold text-[#1d1d1f]"
                    : "border-transparent font-medium text-slate-400 hover:text-slate-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {items.length > 0 ? (
          <ul className="mt-6 space-y-3">
            {items.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center px-4 py-20 text-center">
            <div className="flex h-28 w-36 items-center justify-center rounded-[40%] bg-[#e8eef8]">
              <ClipboardList className="h-12 w-12 text-[#9aa7c2]" strokeWidth={1.25} />
            </div>
            <h2 className="mt-6 text-lg font-semibold text-[#3a3a3a]">
              {empty.title}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
              {empty.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: MyTaskItem }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">
        {PLATFORM_LABELS[task.platform] ?? task.platform}
        {task.brandName ? ` · ${task.brandName}` : ""}
      </p>
      <p className="mt-1 text-sm text-slate-800">{task.captionPreview}</p>
      {task.comments ? (
        <p className="mt-1 text-xs text-slate-500">“{task.comments}”</p>
      ) : null}
      <p className="mt-2 text-[11px] text-slate-400">
        Requested {task.requestedAt}
      </p>
    </li>
  );
}
