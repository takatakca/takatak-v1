import Link from "next/link";

import { sendSavedOutputToApproval } from "@/app/dashboard/ai-studio/saved/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type { HandoffTargetOption } from "@/lib/ai/ai-data";
import { AI_KIND_LABELS, AI_ORIGIN_LABELS, AI_OUTPUT_STATUS_LABELS, aiToneForStatus } from "@/lib/ai/status";
import type { SavedOutputSummary } from "@/lib/ai/types";
import { PLATFORM_LABELS } from "@/lib/social/status";

export function SavedOutputCard({
  output,
  canSend = false,
  targets = [],
}: {
  output: SavedOutputSummary;
  canSend?: boolean;
  targets?: HandoffTargetOption[];
}) {
  const sent = Boolean(output.socialPostId);
  const sendable = canSend && !sent && output.status !== "archived";
  const relevant = targets.filter((target) => !output.brandName || !target.brandName || target.brandName === output.brandName);
  const preferred = relevant.find((target) => target.publishReady) ?? relevant[0] ?? null;

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
          <form action={sendSavedOutputToApproval} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="outputId" value={output.id} />
            {relevant.length > 0 ? (
              <>
                <label className="sr-only" htmlFor={`target-${output.id}`}>
                  Compte de destination
                </label>
                <select
                  id={`target-${output.id}`}
                  name="socialAccountId"
                  defaultValue={preferred?.id ?? ""}
                  className="h-8 max-w-[16rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
                >
                  {relevant.map((target) => (
                    <option key={target.id} value={target.id}>
                      {PLATFORM_LABELS[target.platform] ?? target.platform} · {target.displayName}
                      {target.publishReady ? " · publication auto" : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
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
