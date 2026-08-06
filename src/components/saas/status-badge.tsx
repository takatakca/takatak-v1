import {
  Badge,
  toneForStatus,
} from "@/components/ui/badge";

const LABELS: Record<string, string> = {
  planned: "Planned",
  foundation: "Foundation",
  mock_data: "Mock data",
  not_connected: "Not connected",
  disabled: "Disabled",
  needs_configuration: "Needs configuration",
  ready_for_auth: "Ready for auth",
  ready_for_integration: "Ready for integration",
  connected: "Connected",
  starter: "Starter",
  growth: "Growth",
  premium: "Premium",
  manual: "Manual",
  scheduled: "Scheduled",
  webhook: "Webhook",
  workflow: "Workflow",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
  draft: "Draft",
  prospect: "Prospect",
  suspended: "Suspended",
  primary: "Primary",
};

export function statusLabel(
  status: string,
): string {
  return LABELS[status] ?? status;
}

export function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <Badge tone={toneForStatus(status)}>
      {statusLabel(status)}
    </Badge>
  );
}

// import { Badge, toneForStatus } from "@/components/ui/badge";

// const LABELS: Record<string, string> = {
//   planned: "Planned",
//   foundation: "Foundation",
//   mock_data: "Mock data",
//   not_connected: "Not connected",
//   disabled: "Disabled",
//   needs_configuration: "Needs configuration",
//   ready_for_auth: "Ready for auth",
//   ready_for_integration: "Ready for integration",
//   connected: "Connected",
//   starter: "Starter",
//   growth: "Growth",
//   premium: "Premium",
//   manual: "Manual",
//   scheduled: "Scheduled",
//   webhook: "Webhook",
//   workflow: "Workflow",
// };

// export function statusLabel(status: string) {
//   return LABELS[status] ?? status;
// }

// export function StatusBadge({ status }: { status: string }) {
//   return <Badge tone={toneForStatus(status)}>{statusLabel(status)}</Badge>;
// }
