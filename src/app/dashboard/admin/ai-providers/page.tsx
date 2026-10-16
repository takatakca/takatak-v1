import Link from "next/link";

import { AdminHeader } from "@/components/admin/admin-header";
import { AiProviderKeyRow } from "@/components/admin/ai-provider-key-row";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CATEGORY_LABELS, OUTCOME_MESSAGES, type AiProviderCategory } from "@/lib/ai-providers/catalog";
import { listProviderKeys, providerKeysStorageReady, type ProviderKeyState, type ProviderKeyView } from "@/lib/ai-providers/store";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const STATE_BADGES: Record<ProviderKeyState, { label: string; tone: "success" | "warning" | "muted" | "neutral" | "danger" }> = {
  verified: { label: "Key works", tone: "success" },
  saved_untested: { label: "Saved, not tested", tone: "warning" },
  check_failed: { label: "Test failed", tone: "danger" },
  no_automatic_check: { label: "Saved, no automatic test", tone: "neutral" },
  env_only: { label: "Server variable, not tested", tone: "neutral" },
  not_configured: { label: "No key", tone: "muted" },
};

const CATEGORY_ORDER: AiProviderCategory[] = ["text", "voice", "video", "image", "music", "builder"];

const dateTime = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });

function ProviderCard({ provider, canWrite }: { provider: ProviderKeyView; canWrite: boolean }) {
  const badge = STATE_BADGES[provider.state];
  return (
    <Card>
      <CardHeader
        title={provider.name}
        subtitle={provider.note ?? (provider.billableToClients ? "Clients use it through AI credits." : "Not resold to clients.")}
        action={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />
      <CardBody className="space-y-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
          <dt>Saved key</dt>
          <dd className="font-mono text-slate-700">{provider.keyHint ? `••••${provider.keyHint}` : "None"}</dd>
          <dt>Last test</dt>
          <dd className="text-slate-700">
            {provider.lastCheckedAt && provider.lastCheckOutcome
              ? `${dateTime.format(new Date(provider.lastCheckedAt))}: ${OUTCOME_MESSAGES[provider.lastCheckOutcome]}`
              : "Never"}
          </dd>
          <dt>Server variable</dt>
          <dd className="font-mono text-slate-700">{provider.env}</dd>
        </dl>
        {provider.noCheckReason ? <p className="text-xs text-slate-500">{provider.noCheckReason}</p> : null}
        <AiProviderKeyRow
          provider={provider.key}
          name={provider.name}
          hasSavedKey={provider.keyHint !== null}
          checkable={provider.checkable}
          canWrite={canWrite}
        />
      </CardBody>
    </Card>
  );
}

export default async function AiProviderKeysPage() {
  const access = await requireAdminAccess();
  const canWrite = access.enforced && access.profileId !== null;
  const storageReady = providerKeysStorageReady();

  let providers: ProviderKeyView[] | null = null;
  try {
    providers = await listProviderKeys();
  } catch {
    console.error("[ai-provider-keys] list unavailable");
  }

  const verified = providers?.filter((p) => p.state === "verified").length ?? 0;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="AI provider keys"
        subtitle="Enter the API key of each AI provider. Keys are encrypted on the server and never shown again: only the last four characters stay visible. Clients use these providers through AI credits."
        badges={["Platform owners and admins"]}
        actions={
          <Link href="/dashboard/growth/ai-engine" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-blue-300">
            AI Engine & credits →
          </Link>
        }
      />

      {!storageReady ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Key storage is not set up on this server. Add <code className="font-mono">GROWTH_TOKEN_ENCRYPTION_KEY_V1</code> (32 random bytes, Base64) to the
          server environment, then reload this page.
        </div>
      ) : null}

      {providers === null ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The database is not available, so saved keys cannot be shown.
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {verified} of {providers.length} providers have a key that passed its test. A key is only marked as working after a real test with the provider.
          </p>
          {CATEGORY_ORDER.map((category) => {
            const group = providers.filter((p) => p.category === category);
            if (group.length === 0) return null;
            return (
              <section key={category} className="space-y-3" aria-label={CATEGORY_LABELS[category]}>
                <h2 className="text-sm font-semibold text-slate-900">{CATEGORY_LABELS[category]}</h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.map((provider) => (
                    <ProviderCard key={provider.key} provider={provider} canWrite={canWrite && storageReady} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
