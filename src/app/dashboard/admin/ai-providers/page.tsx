import Link from "next/link";

import { AdminHeader } from "@/components/admin/admin-header";
import { AiProviderKeyRow } from "@/components/admin/ai-provider-key-row";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CATEGORY_LABELS, OUTCOME_MESSAGES, type AiProviderCategory } from "@/lib/ai-providers/catalog";
import { listProviderKeys, providerKeysStorageReady, type ProviderKeyState, type ProviderKeyView } from "@/lib/ai-providers/store";
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const STATE_BADGES: Record<ProviderKeyState, { label: string; labelFr: string; tone: "success" | "warning" | "muted" | "neutral" | "danger" }> = {
  verified: { label: "Key works", labelFr: "La clé fonctionne", tone: "success" },
  saved_untested: { label: "Saved, not tested", labelFr: "Enregistrée, non testée", tone: "warning" },
  check_failed: { label: "Test failed", labelFr: "Test échoué", tone: "danger" },
  no_automatic_check: { label: "Saved, no automatic test", labelFr: "Enregistrée, sans test automatique", tone: "neutral" },
  env_only: { label: "Server variable, not tested", labelFr: "Variable du serveur, non testée", tone: "neutral" },
  not_configured: { label: "No key", labelFr: "Aucune clé", tone: "muted" },
};

const CATEGORY_ORDER: AiProviderCategory[] = ["text", "voice", "video", "image", "music", "builder"];

const dateTimeEn = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });
const dateTimeFr = new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });

function ProviderCard({ provider, canWrite, fr }: { provider: ProviderKeyView; canWrite: boolean; fr: boolean }) {
  const badge = STATE_BADGES[provider.state];
  const dateTime = fr ? dateTimeFr : dateTimeEn;
  return (
    <Card>
      <CardHeader
        title={provider.name}
        subtitle={
          provider.note
            ? adminFr(provider.note, fr)
            : provider.billableToClients
              ? fr
                ? "Les clients l’utilisent avec des crédits IA."
                : "Clients use it through AI credits."
              : fr
                ? "Pas revendu aux clients."
                : "Not resold to clients."
        }
        action={<Badge tone={badge.tone}>{fr ? badge.labelFr : badge.label}</Badge>}
      />
      <CardBody className="space-y-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
          <dt>{fr ? "Clé enregistrée" : "Saved key"}</dt>
          <dd className="font-mono text-slate-700">{provider.keyHint ? `••••${provider.keyHint}` : fr ? "Aucune" : "None"}</dd>
          <dt>{fr ? "Dernier test" : "Last test"}</dt>
          <dd className="text-slate-700">
            {provider.lastCheckedAt && provider.lastCheckOutcome
              ? `${dateTime.format(new Date(provider.lastCheckedAt))}${fr ? " :" : ":"} ${adminFr(OUTCOME_MESSAGES[provider.lastCheckOutcome], fr)}`
              : fr
                ? "Jamais"
                : "Never"}
          </dd>
          <dt>{fr ? "Variable du serveur" : "Server variable"}</dt>
          <dd className="font-mono text-slate-700">{provider.env}</dd>
        </dl>
        {provider.noCheckReason ? <p className="text-xs text-slate-500">{adminFr(provider.noCheckReason, fr)}</p> : null}
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
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
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
        title={fr ? "Clés des fournisseurs IA" : "AI provider keys"}
        subtitle={
          fr
            ? "Saisissez la clé API de chaque fournisseur IA. Les clés sont chiffrées sur le serveur et ne sont plus jamais affichées : seuls les quatre derniers caractères restent visibles. Les clients utilisent ces fournisseurs avec des crédits IA."
            : "Enter the API key of each AI provider. Keys are encrypted on the server and never shown again: only the last four characters stay visible. Clients use these providers through AI credits."
        }
        badges={[fr ? "Propriétaires et administrateurs de la plateforme" : "Platform owners and admins"]}
        actions={
          <Link href="/dashboard/growth/ai-engine" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-blue-300">
            {fr ? "Moteur IA et crédits →" : "AI Engine & credits →"}
          </Link>
        }
      />

      {!storageReady ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {fr ? "Le stockage des clés n’est pas prêt sur ce serveur. Ajoutez" : "Key storage is not set up on this server. Add"}{" "}
          <code className="font-mono">GROWTH_TOKEN_ENCRYPTION_KEY_V1</code>{" "}
          {fr
            ? "(32 octets au hasard, en Base64) à l’environnement du serveur, puis rechargez cette page."
            : "(32 random bytes, Base64) to the server environment, then reload this page."}
        </div>
      ) : null}

      {providers === null ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {fr
            ? "La base de données n’est pas disponible : les clés enregistrées ne peuvent pas être affichées."
            : "The database is not available, so saved keys cannot be shown."}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {fr
              ? `${verified} des ${providers.length} fournisseurs ont une clé qui a réussi son test. Une clé est marquée « fonctionne » seulement après un vrai test avec le fournisseur.`
              : `${verified} of ${providers.length} providers have a key that passed its test. A key is only marked as working after a real test with the provider.`}
          </p>
          {CATEGORY_ORDER.map((category) => {
            const group = providers.filter((p) => p.category === category);
            if (group.length === 0) return null;
            return (
              <section key={category} className="space-y-3" aria-label={adminFr(CATEGORY_LABELS[category], fr)}>
                <h2 className="text-sm font-semibold text-slate-900">{adminFr(CATEGORY_LABELS[category], fr)}</h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.map((provider) => (
                    <ProviderCard key={provider.key} provider={provider} canWrite={canWrite && storageReady} fr={fr} />
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
