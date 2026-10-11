// TK-026 — Turn a stored report into a client PDF and an in-dashboard delivery.
// No public link and no email. The HTML of the dashboard is not stored.

export type DeliveryDecision =
  | { action: "refuse"; reason: "archived" }
  | { action: "already"; shareId: string }
  | { action: "deliver" };

export interface ExportSection {
  title: string;
  content: string | null;
}

export interface ExportMetric {
  label: string;
  value: string;
  unit: string | null;
}

export interface ExportReport {
  title: string;
  clientName: string;
  summary: string | null;
  sections: ExportSection[];
  metrics: ExportMetric[];
}

export function internalReportPath(reportId: string): string {
  return `/dashboard/reports/preview?id=${encodeURIComponent(reportId)}`;
}

export function decideDelivery(report: { status: string }, existingShareId: string | null): DeliveryDecision {
  if (report.status === "archived") return { action: "refuse", reason: "archived" };
  if (existingShareId) return { action: "already", shareId: existingShareId };
  return { action: "deliver" };
}

export function reportPdfLines(report: ExportReport): string[] {
  const who = report.clientName.replace(/\s+/g, " ").trim().slice(0, 80) || "Client";
  const lines = [
    "Rapport",
    `Préparé pour : ${who}`,
    report.title.replace(/\s+/g, " ").trim().slice(0, 110),
    "",
  ];
  if (report.summary) lines.push(report.summary.replace(/\s+/g, " ").trim().slice(0, 110), "");
  lines.push("Sections");
  for (const section of report.sections.slice(0, 12)) {
    lines.push(section.title.replace(/\s+/g, " ").trim().slice(0, 110));
    if (section.content) lines.push(`  ${section.content.replace(/\s+/g, " ").trim()}`.slice(0, 110));
  }
  lines.push("", "Mesures");
  for (const metric of report.metrics.slice(0, 16)) {
    const unit = metric.unit ? ` ${metric.unit}` : "";
    lines.push(`${metric.label} : ${metric.value}${unit}`.replace(/\s+/g, " ").trim().slice(0, 110));
  }
  lines.push("", "Remis dans le tableau de bord. Aucun courriel. Aucun lien public.");
  return lines;
}
