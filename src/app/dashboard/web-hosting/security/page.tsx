import Link from "next/link";

import { SecurityCheckForm } from "@/components/web-hosting/security-check-form";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";

export const dynamic = "force-dynamic";

/** The workspace's own domains, offered as suggestions (the check works for any public site). */
async function workspaceDomains(clientId: string): Promise<string[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    const [domains, sites] = await Promise.all([
      prisma.domainAsset.findMany({ where: { clientId }, select: { domainName: true }, take: 20 }),
      prisma.analyticsSite.findMany({ where: { clientId, active: true }, select: { domain: true }, take: 20 }),
    ]);
    return [...new Set([...domains.map((d) => d.domainName), ...sites.map((s) => s.domain)].map((d) => d.trim().toLowerCase()).filter(Boolean))];
  } catch {
    return [];
  }
}

export default async function WebsiteSecurityPage() {
  const { access } = await getServerAccessContext();
  const suggestions = access.mode === "client_scoped" ? await workspaceDomains(access.activeClientId) : [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Sécurité du site · Website security</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Ce que votre site montre au monde : chiffrement, certificat et protections du navigateur, avec ce qu’il faut corriger · What your
          site shows the world: encryption, certificate and browser protections, with what to fix.
        </p>
      </div>
      <SecurityCheckForm suggestions={suggestions} />
      <p className="text-xs text-slate-500">
        Besoin d’aide pour corriger ? · Need help fixing it?{" "}
        <Link href="/dashboard/support" className="font-semibold text-emerald-700 hover:underline">Demander à l’équipe · Ask the team</Link>
      </p>
    </div>
  );
}
