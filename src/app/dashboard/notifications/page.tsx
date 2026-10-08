import Link from "next/link";
import { Bell } from "lucide-react";

import { MarkReadButton } from "@/components/notifications/mark-read-button";
import { EmptyState } from "@/components/saas/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { getPrisma } from "@/lib/db/prisma";
import { listWorkspaceNotifications } from "@/lib/notifications/workspace-notifications";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

function when(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(date);
}

export default async function NotificationsPage() {
  const access = await requireWorkspacePermission("view_dashboard", "/dashboard/notifications");
  const prisma = getPrisma();

  if (!prisma) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
        <EmptyState
          icon={Bell}
          title="Notifications are unavailable"
          description="The database is not reachable right now. Try again shortly."
        />
      </div>
    );
  }

  const { notifications, unread } = await listWorkspaceNotifications(
    prisma,
    access.activeClientId,
    access.profileId ?? null,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            New website requests and orders, approvals and system events for this workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={unread ? "warning" : "neutral"}>{unread} unread</Badge>
          {unread ? <MarkReadButton label="Mark all as read" /> : null}
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="New website leads, orders and approvals will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <Card>
                <CardBody className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {n.status === "unread" ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Unread" />
                      ) : null}
                      <h2 className={`text-sm ${n.status === "unread" ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                        {n.title}
                      </h2>
                    </div>
                    <p className="break-words text-sm text-slate-600">{n.message}</p>
                    <p className="text-xs text-slate-400">{when(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {n.href ? (
                      <Link href={n.href} className="text-xs font-semibold text-emerald-700 hover:underline">
                        Open
                      </Link>
                    ) : null}
                    {n.status === "unread" ? <MarkReadButton ids={[n.id]} label="Mark read" /> : null}
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
