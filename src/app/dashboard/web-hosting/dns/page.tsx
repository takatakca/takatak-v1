import Link from "next/link";

import { DnsRecordList } from "@/components/web-hosting/dns-record-list";
import { DnsCheckForm } from "@/components/web-hosting/dns-check-form";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { getDnsRecordsData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

async function workspaceDomains(clientId: string): Promise<string[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    const rows = await prisma.domainAsset.findMany({ where: { clientId }, select: { domainName: true }, take: 20 });
    return [...new Set(rows.map((row) => row.domainName.trim().toLowerCase()).filter(Boolean))];
  } catch {
    return [];
  }
}

export default async function DnsPage() {
  const { access } = await getServerAccessContext();
  const suggestions = access.mode === "client_scoped" ? await workspaceDomains(access.activeClientId) : [];
  const staffRecords = access.mode === "platform_admin" ? await getDnsRecordsData() : null;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">DNS et courriel · DNS & email</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Vérifiez que votre domaine mène au site et que vos courriels ne vont pas aux pourriels (MX, SPF, DMARC) · Check that your domain
          leads to your website and that your emails stay out of spam (MX, SPF, DMARC).
        </p>
      </div>
      <DnsCheckForm suggestions={suggestions} />
      <p className="text-xs text-slate-500">
        Pour changer un enregistrement, l’équipe s’en occupe · To change a record, the team handles it:{" "}
        <Link href="/dashboard/support" className="font-semibold text-emerald-700 hover:underline">Demander · Ask</Link>
      </p>
      {staffRecords && staffRecords.records.length ? (
        <section className="space-y-2" aria-label="Internal DNS tracking">
          <h2 className="text-sm font-semibold text-slate-900">Suivi interne (personnel) · Internal tracking (staff)</h2>
          <DnsRecordList records={staffRecords.records} />
        </section>
      ) : null}
    </div>
  );
}
