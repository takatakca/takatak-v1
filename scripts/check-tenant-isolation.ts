// Phase 15A — TWO-TENANT ISOLATION TEST against a real Postgres database.
// Creates two clients with REAL rows in every module, two client-scoped
// profiles, then calls the REAL data-layer functions with explicit access
// contexts and asserts zero cross-tenant leakage. Exits nonzero on ANY leak.
//
// Run with DATABASE_URL/DIRECT_URL pointing at a DISPOSABLE database:
//   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/check-tenant-isolation.ts
// Run with DATABASE_URL/DIRECT_URL pointing at a DISPOSABLE database:
//   DATABASE_URL=... DIRECT_URL=... npx tsx --require ./scripts/register-server-only.cjs scripts/check-tenant-isolation.ts
import { getPrisma } from "../src/lib/db/prisma";
import { getSocialOverviewData, getSocialPostsData } from "../src/lib/social/social-data";
import { getWebHostingOverviewData } from "../src/lib/web-hosting/web-hosting-data";
import { getAiStudioOverviewData } from "../src/lib/ai/ai-data";
import { getReportsOverviewData, getReportPreviewData } from "../src/lib/reports/reporting-data";
import { getLocalListingsOverviewData } from "../src/lib/local-listings/local-listings-data";
import { getLeadsOverviewData, getLeadContactsData } from "../src/lib/leads/leads-data";
import { getDashboardOverviewData } from "../src/lib/db/dashboard-data";
import { getAdminClientsData } from "../src/lib/admin/admin-data";
import type { TenantAccess } from "../src/lib/security/tenant-access";

const prismaOrNull = getPrisma();
if (!prismaOrNull) {
  console.error("[tenant-isolation] DATABASE_URL is required");
  process.exit(1);
}
const prisma = prismaOrNull;
let failures = 0;
function assert(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name} ${detail}`); }
}

const scopedAccess = (clientId: string): TenantAccess => ({
  mode: "client_scoped",
  profileId: "test",
  role: "manager",
  allowedClientIds: [clientId],
  activeClientId: clientId,
  customPermissions: [],
  deniedPermissions: [],
});
const adminAccess: TenantAccess = {
  mode: "platform_admin",
  profileId: "test",
  role: "owner",
  allowedClientIds: "all",
  customPermissions: [],
  deniedPermissions: [],
};
const deniedAccess: TenantAccess = { mode: "denied", reason: "membership_missing" };

async function makeTenant(tag: string) {
  const client = await prisma.client.create({ data: { name: `Isolation ${tag}`, status: "active" } });
  const brand = await prisma.businessBrand.create({ data: { clientId: client.id, name: `Brand ${tag}`, status: "active" } });
  await prisma.socialPost.create({ data: { clientId: client.id, businessBrandId: brand.id, platform: "linkedin", caption: `SECRET-${tag}-POST`, status: "draft" } });
  await prisma.domainAsset.create({ data: { clientId: client.id, businessBrandId: brand.id, domainName: `secret-${tag.toLowerCase()}.demo`, registrar: "internal_demo", status: "planned" } });
  await prisma.brandVoice.create({ data: { clientId: client.id, businessBrandId: brand.id, name: `SECRET-${tag}-VOICE`, tone: `secret ${tag}` } });
  await prisma.report.create({ data: { clientId: client.id, businessBrandId: brand.id, type: "client_summary", title: `SECRET-${tag}-REPORT`, status: "draft", summary: `secret ${tag}` } });
  await prisma.localListing.create({ data: { clientId: client.id, businessBrandId: brand.id, provider: "internal_demo", name: `SECRET-${tag}-LISTING`, platformName: "Internal", status: "draft" } });
  await prisma.lead.create({ data: { clientId: client.id, businessBrandId: brand.id, name: `SECRET-${tag}-LEAD`, email: `${tag.toLowerCase()}@example.test`, status: "new_internal" } });
  return { client, brand };
}

async function main() {
  console.log("[tenant-isolation] preparing two tenants with real module rows…");
  const A = await makeTenant("AAA");
  const B = await makeTenant("BBB");

  const asA = scopedAccess(A.client.id);
  const asB = scopedAccess(B.client.id);

  console.log("[tenant-isolation] Tenant A view:");
  const socialA = await getSocialPostsData(asA);
  assert("A sees own social post only", JSON.stringify(socialA).includes("SECRET-AAA") && !JSON.stringify(socialA).includes("SECRET-BBB"));
  const socialOvA = await getSocialOverviewData(asA);
  assert("A overview never contains B content", !JSON.stringify(socialOvA).includes("SECRET-BBB"));
  const webA = await getWebHostingOverviewData(asA);
  assert("A sees own domain only", JSON.stringify(webA).includes("secret-aaa.demo") && !JSON.stringify(webA).includes("secret-bbb.demo"));
  const aiA = await getAiStudioOverviewData(asA);
  assert("A sees own brand voice only", JSON.stringify(aiA).includes("SECRET-AAA-VOICE") && !JSON.stringify(aiA).includes("SECRET-BBB"));
  const repA = await getReportsOverviewData(asA);
  assert("A sees own report only", JSON.stringify(repA).includes("SECRET-AAA-REPORT") && !JSON.stringify(repA).includes("SECRET-BBB"));
  const locA = await getLocalListingsOverviewData(asA);
  assert("A sees own listing only", JSON.stringify(locA).includes("SECRET-AAA-LISTING") && !JSON.stringify(locA).includes("SECRET-BBB"));
  const leadA = await getLeadsOverviewData(asA);
  assert("A sees own lead only", JSON.stringify(leadA).includes("SECRET-AAA-LEAD") && !JSON.stringify(leadA).includes("SECRET-BBB"));
  const dashA = await getDashboardOverviewData(asA);
  assert("A dashboard counts exactly 1 client", dashA.kpis.clients === 1, `got ${dashA.kpis.clients}`);

  console.log("[tenant-isolation] Tenant B mirror:");
  const socialB = await getSocialPostsData(asB);
  assert("B sees own post only", JSON.stringify(socialB).includes("SECRET-BBB") && !JSON.stringify(socialB).includes("SECRET-AAA"));
  const leadB = await getLeadContactsData(asB);
  assert("B sees own lead only", JSON.stringify(leadB).includes("SECRET-BBB-LEAD") && !JSON.stringify(leadB).includes("SECRET-AAA"));

  console.log("[tenant-isolation] Report preview cross-tenant probe (direct id request):");
  const bReport = await prisma.report.findFirst({ where: { title: "SECRET-BBB-REPORT" }, select: { id: true } });
  const stolen = await getReportPreviewData(bReport!.id, asA);
  assert("A requesting B report id gets NOTHING", stolen.report === null && !JSON.stringify(stolen).includes("SECRET-BBB"));

  console.log("[tenant-isolation] Platform admin (global, labeled):");
  const dashAdmin = await getDashboardOverviewData(adminAccess);
  assert("admin sees both tenants (>=2 clients)", dashAdmin.kpis.clients >= 2, `got ${dashAdmin.kpis.clients}`);
  const adminClients = await getAdminClientsData(adminAccess);
  assert("admin-data works for platform_admin", adminClients.source === "database" && adminClients.clients.length >= 2);

  console.log("[tenant-isolation] Denied / gated paths:");
  const deniedDash = await getDashboardOverviewData(deniedAccess);
  assert("denied gets unavailable + zero data", deniedDash.source === "unavailable" && deniedDash.kpis.clients === 0 && deniedDash.integrations.length === 0);
  const adminAsScoped = await getAdminClientsData(asA);
  assert("client-scoped CANNOT read admin data", adminAsScoped.source === "unavailable" && adminAsScoped.clients.length === 0);
  const selReq: TenantAccess = {
    mode: "selection_required",
    profileId: "t",
    platformRole: "user",
    allowedClientIds: [
      A.client.id,
      B.client.id,
    ],
  };
  const selDash = await getDashboardOverviewData(selReq);
  assert("selection_required yields no data", selDash.source === "unavailable" && selDash.kpis.clients === 0);

  console.log(failures === 0 ? "\nTENANT ISOLATION: ALL CHECKS PASSED" : `\nTENANT ISOLATION: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("[tenant-isolation] crashed:", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
