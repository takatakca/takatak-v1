import Link from "next/link";
import { ExternalLink } from "lucide-react";

import {
  DataTable,
  type Column,
} from "@/components/saas/data-table";
import { StatusBadge } from "@/components/saas/status-badge";
import type { ClientListItem } from "@/lib/clients/client-data";

const dateFormatter = new Intl.DateTimeFormat(
  "en-CA",
  {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
);

const columns: Column<ClientListItem>[] = [
  {
    key: "workspace",
    header: "Workspace",
    render: (client) => (
      <div>
        <Link
          href={`/dashboard/clients/${client.id}`}
          className="font-medium text-slate-900 hover:text-indigo-600"
        >
          {client.name}
        </Link>

        <p className="mt-0.5 text-xs text-slate-400">
          {client.companyName ??
            client.email ??
            "No company details"}
        </p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (client) => (
      <StatusBadge status={client.status} />
    ),
  },
  {
    key: "plan",
    header: "Plan",
    render: (client) => (
      <span className="text-xs text-slate-600">
        {client.planName ?? "Not assigned"}
      </span>
    ),
  },
  {
    key: "owners",
    header: "Owner",
    render: (client) => (
      <span className="text-xs text-slate-600">
        {client.ownerNames.join(", ") ||
          "No active owner"}
      </span>
    ),
  },
  {
    key: "footprint",
    header: "Footprint",
    render: (client) => (
      <span className="text-xs text-slate-600">
        {client.brandCount} brands ·{" "}
        {client.locationCount} locations ·{" "}
        {client.memberCount} members
      </span>
    ),
  },
  {
    key: "created",
    header: "Created",
    render: (client) => (
      <span className="text-xs text-slate-500">
        {dateFormatter.format(
          new Date(client.createdAt),
        )}
      </span>
    ),
  },
  {
    key: "open",
    header: "",
    render: (client) => (
      <Link
        href={`/dashboard/clients/${client.id}`}
        aria-label={`Open ${client.name}`}
        className="inline-flex rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
      >
        <ExternalLink className="h-4 w-4" />
      </Link>
    ),
  },
];

export function ClientList({
  clients,
}: {
  clients: ClientListItem[];
}) {
  return (
    <DataTable
      columns={columns}
      rows={clients}
      rowKey={(client) => client.id}
      caption="Real TAKATAK client workspaces"
    />
  );
}