import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type { BrandVoiceSummary } from "@/lib/ai/types";

export function BrandVoiceCard({ voice }: { voice: BrandVoiceSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{voice.name}</h3>
            <p className="text-[11px] text-slate-400">{voice.brandName ?? "Unassigned brand"} · {voice.language.toUpperCase()}</p>
          </div>
          <Badge tone="neutral">Voice profile</Badge>
        </div>
        {voice.tone ? <p className="text-xs text-slate-600"><span className="font-medium">Tone:</span> {voice.tone}</p> : null}
        {voice.audience ? <p className="text-xs text-slate-600"><span className="font-medium">Audience:</span> {voice.audience}</p> : null}
        {voice.keywords.length ? (
          <div className="flex flex-wrap gap-1.5">
            {voice.keywords.map((k) => (
              <span key={k} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">{k}</span>
            ))}
          </div>
        ) : null}
        {voice.bannedPhrases.length ? (
          <p className="text-[11px] text-slate-400">Avoid: {voice.bannedPhrases.join(", ")}</p>
        ) : null}
        {voice.sampleCaption ? <p className="text-[11px] italic text-slate-400">{voice.sampleCaption}</p> : null}
      </CardBody>
    </Card>
  );
}
