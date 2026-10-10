import Link from "next/link";

import { sendSavedOutputToApproval } from "@/app/dashboard/ai-studio/saved/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { AI_KIND_LABELS, AI_ORIGIN_LABELS, AI_OUTPUT_STATUS_LABELS, aiToneForStatus } from "@/lib/ai/status";
import type { SavedOutputSummary } from "@/lib/ai/types";

export function SavedOutputCard({
  output,
  canSend = false,
}: {
  output: SavedOutputSummary;
  canSend?: boolean;
}) {
  const sent = Boolean(output.socialPostId);
  const sendable = canSend && !sent && output.status !== "archived";

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{output.title}</h3>
            <p className="text-[11px] text-slate-400">
              {AI_KIND_LABELS[output.kind] ?? output.kind} · {output.brandName ?? "—"}
            </p>
          </div>
          <Badge tone={aiToneForStatus(output.origin)}>{AI_ORIGIN_LABELS[output.origin] ?? output.origin}</Badge>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">{output.contentPreview}</p>
        <p className="text-[11px] text-slate-400">
          {AI_OUTPUT_STATUS_LABELS[output.status] ?? output.status} · {output.createdAt}
          {output.voiceName ? ` · Voice: ${output.voiceName}` : ""}
        </p>
        {sent ? (
          <Link href="/dashboard/social/approvals" className="inline-block text-xs font-medium text-indigo-700 hover:text-indigo-500">
            {"Voir l'approbation"}
          </Link>
        ) : null}
        {sendable ? (
          <form action={sendSavedOutputToApproval}>
            <input type="hidden" name="outputId" value={output.id} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
            >
              {"Envoyer à l'approbation"}
            </button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
