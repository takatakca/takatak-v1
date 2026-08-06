import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/saas/empty-state";

export function ReportEmptyState({ title, description, icon }: { title: string; description: string; icon?: LucideIcon }) {
  return <EmptyState title={title} description={description} icon={icon} />;
}
