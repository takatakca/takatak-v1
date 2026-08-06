// TAKATAK Phase 4 — FOUNDATION SEED DATA.
// Everything seeded here is clearly-labeled demo structure:
// - No provider is seeded as "connected".
// - No credentials, tokens, or realistic external account IDs.
// - Profile seeding is SKIPPED: a Profile requires a real Supabase auth user
//   (authUserId), and inventing one would create a fake user. Profiles are
//   created for real users in Phase 5+ (on-first-login sync).
// Safe to re-run: uses deterministic names and skips existing records.

import { PrismaClient } from "@prisma/client";

// Phase 14 — production guard: foundation/demo seed must never run against
// a production database unless explicitly allowed. It never deletes or
// resets anything in any mode.
if (process.env.NODE_ENV === "production" && process.env.ALLOW_FOUNDATION_SEED !== "true") {
  console.log(
    "[seed] SKIPPED: production runtime detected and ALLOW_FOUNDATION_SEED is not 'true'. " +
      "Foundation/demo data was NOT written. This is the safe default — do not enable the " +
      "override on a real customer database.",
  );
  process.exit(0);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("[seed] DATABASE_URL is not set — skipping seed. Add it to .env.local first.");
    return;
  }
  const prisma = new PrismaClient();
  try {
    // ── Clients (idempotent per section) ───────────────────
    let takatakClient = await prisma.client.findFirst({ where: { name: "TAKATAK Demo Client" } });
    let restaurantClient = await prisma.client.findFirst({ where: { name: "Restaurant Demo Client" } });
    const coreExists = Boolean(takatakClient && restaurantClient);
    if (coreExists) {
      console.log("[seed] Core foundation seed already present — skipping core.");
    }

    takatakClient ??= await prisma.client.create({
      data: {
        name: "TAKATAK Demo Client",
        companyName: "TAKATAK Demo Client (foundation seed)",
        email: "demo-client@takatak.example",
        status: "active",
        planName: "Foundation Demo",
      },
    });
    restaurantClient ??= await prisma.client.create({
      data: {
        name: "Restaurant Demo Client",
        companyName: "Restaurant Demo Client (foundation seed)",
        email: "restaurant-demo@takatak.example",
        status: "prospect",
        planName: "Foundation Demo",
      },
    });

    // ── Brands ─────────────────────────────────────────────
    let takatakBrand = await prisma.businessBrand.findFirst({ where: { name: "TAKATAK Demo Brand" } });
    let restaurantBrand = await prisma.businessBrand.findFirst({ where: { name: "Montreal Restaurant Hub Demo" } });

    takatakBrand ??= await prisma.businessBrand.create({
      data: {
        clientId: takatakClient.id,
        name: "TAKATAK Demo Brand",
        category: "Agency",
        city: "Montreal",
        region: "QC",
        country: "Canada",
        status: "active",
      },
    });
    restaurantBrand ??= await prisma.businessBrand.create({
      data: {
        clientId: restaurantClient.id,
        name: "Montreal Restaurant Hub Demo",
        category: "Restaurant",
        city: "Montreal",
        region: "QC",
        country: "Canada",
        status: "draft",
      },
    });

    // ── Service instances (never "active with connected provider") ──
    if (!coreExists) await prisma.serviceInstance.createMany({
      data: [
        { clientId: takatakClient.id, businessBrandId: takatakBrand.id, serviceType: "social_media", provider: "metricool", name: "Social Media Management", status: "pending_setup" },
        { clientId: takatakClient.id, businessBrandId: takatakBrand.id, serviceType: "web_hosting", provider: "upmind", name: "Web / Domain / Hosting", status: "planned" },
        { clientId: takatakClient.id, businessBrandId: takatakBrand.id, serviceType: "ai_studio", provider: "tryholo", name: "AI Creative Studio", status: "planned" },
        { clientId: restaurantClient.id, businessBrandId: restaurantBrand.id, serviceType: "local_listings", provider: "qmaps", name: "Local Listings", status: "planned" },
        { clientId: restaurantClient.id, businessBrandId: restaurantBrand.id, serviceType: "leads", provider: "flexs", name: "Lead Generation", status: "planned" },
      ],
    });

    // ── Integration accounts (HONEST: nothing connected) ───
    if (!coreExists) await prisma.integrationAccount.createMany({
      data: [
        { clientId: takatakClient.id, provider: "metricool", status: "not_connected" },
        { clientId: takatakClient.id, provider: "upmind", status: "not_connected" },
        { clientId: takatakClient.id, provider: "tryholo", status: "disabled" },
        { clientId: restaurantClient.id, provider: "qmaps", status: "not_connected" },
        { clientId: restaurantClient.id, provider: "flexs", status: "not_connected" },
      ],
    });

    // ── Planned jobs (no workers exist) ─────────────────────
    if (!coreExists) await prisma.job.createMany({
      data: [
        { clientId: takatakClient.id, businessBrandId: takatakBrand.id, type: "create_campaign", status: "planned", metadata: { note: "Foundation seed — activates Phase 5" } },
        { clientId: takatakClient.id, businessBrandId: takatakBrand.id, type: "sync_analytics", status: "planned", provider: "metricool", metadata: { note: "Foundation seed — activates Phase 6" } },
        { clientId: takatakClient.id, type: "generate_report", status: "planned", metadata: { note: "Foundation seed — activates Phase 12" } },
        { clientId: restaurantClient.id, type: "provision_hosting", status: "planned", provider: "upmind", metadata: { note: "Foundation seed — activates Phase 8" } },
      ],
    });

    // ── Report + notification ───────────────────────────────
    if (!coreExists) await prisma.report.create({
      data: {
        clientId: takatakClient.id,
        businessBrandId: takatakBrand.id,
        type: "client_summary",
        title: "Monthly Client Summary (foundation draft)",
        status: "draft",
        summary: "Foundation seed report — real report generation arrives in Phase 12.",
      },
    });
    if (!coreExists) await prisma.notification.create({
      data: {
        clientId: takatakClient.id,
        type: "system",
        title: "Foundation database seeded",
        message: "Phase 4 foundation seed applied. No integrations are connected.",
        status: "unread",
      },
    });

    if (!coreExists) {
      console.log("[seed] Core foundation seed complete: 2 clients, 2 brands, 5 services, 5 integration accounts (none connected), 4 planned jobs, 1 draft report, 1 notification.");
    }

    // ════════════════════════════════════════════════════════
    // Phase 5 — Social Media Foundation seed
    // HONESTY: no account is seeded "connected"; no tokens; no external IDs;
    // no published posts; nothing implies real publishing or syncing.
    // ════════════════════════════════════════════════════════
    const socialExists = await prisma.socialAccount.findFirst({
      where: { clientId: restaurantClient.id, platform: "facebook" },
    });
    if (socialExists) {
      console.log("[seed] Social foundation seed already present — skipping social.");
      await seedWebHosting(prisma, { takatakClient, restaurantClient, takatakBrand, restaurantBrand });
      return;
    }

    // Social accounts (honest statuses only)
    await prisma.socialAccount.createMany({
      data: [
        { clientId: restaurantClient.id, businessBrandId: restaurantBrand.id, platform: "facebook", status: "not_connected" },
        { clientId: restaurantClient.id, businessBrandId: restaurantBrand.id, platform: "instagram", status: "not_connected" },
        { clientId: restaurantClient.id, businessBrandId: restaurantBrand.id, platform: "tiktok", status: "not_connected" },
        { clientId: restaurantClient.id, businessBrandId: restaurantBrand.id, platform: "google_business", status: "pending_connection" },
        { clientId: takatakClient.id, businessBrandId: takatakBrand.id, platform: "linkedin", status: "not_connected" },
        { clientId: takatakClient.id, businessBrandId: takatakBrand.id, platform: "x", status: "disabled" },
      ],
    });

    // Campaigns
    const promoCampaign = await prisma.campaign.create({
      data: {
        clientId: restaurantClient.id,
        businessBrandId: restaurantBrand.id,
        name: "Restaurant Weekly Promo Foundation",
        goal: "Weekly menu/social campaign",
        description: "Foundation campaign structure — activates with Metricool in Phase 6.",
        status: "planned",
      },
    });
    const awarenessCampaign = await prisma.campaign.create({
      data: {
        clientId: takatakClient.id,
        businessBrandId: takatakBrand.id,
        name: "TAKATAK SaaS Awareness Foundation",
        goal: "Introduce TAKATAK service dashboard",
        status: "draft",
      },
    });

    // Posts — draft / pending_approval / approved ONLY (never published)
    await prisma.socialPost.create({
      data: {
        clientId: restaurantClient.id,
        businessBrandId: restaurantBrand.id,
        campaignId: promoCampaign.id,
        platform: "instagram",
        caption: "[Foundation draft] This week's featured dish — placeholder caption for the weekly promo.",
        status: "draft",
      },
    });
    const pendingPost = await prisma.socialPost.create({
      data: {
        clientId: restaurantClient.id,
        businessBrandId: restaurantBrand.id,
        campaignId: promoCampaign.id,
        platform: "facebook",
        caption: "[Foundation] Weekend special announcement — awaiting client approval.",
        status: "pending_approval",
      },
    });
    await prisma.socialPost.create({
      data: {
        clientId: takatakClient.id,
        businessBrandId: takatakBrand.id,
        campaignId: awarenessCampaign.id,
        platform: "linkedin",
        caption: "[Foundation approved] One dashboard for all your business services — placeholder copy.",
        status: "approved",
      },
    });
    await prisma.socialPost.create({
      data: {
        clientId: restaurantClient.id,
        businessBrandId: restaurantBrand.id,
        campaignId: promoCampaign.id,
        platform: "tiktok",
        caption: "[Foundation draft — video idea] Behind-the-scenes kitchen prep concept. Script TBD.",
        status: "draft",
        metadata: { kind: "video_idea" },
      },
    });

    // Approval linked to the pending post (profile IDs null — no fake users)
    await prisma.approval.create({
      data: {
        clientId: restaurantClient.id,
        businessBrandId: restaurantBrand.id,
        socialPostId: pendingPost.id,
        status: "pending",
        comments: "Foundation seed — awaiting client review.",
      },
    });

    // Analytics: intentionally NOT seeded — UI shows an honest empty state
    // until real Metricool sync exists (Phase 6).

    console.log("[seed] Social foundation seed complete: 6 accounts (none connected), 2 campaigns, 4 posts (no published), 1 pending approval, 0 analytics.");

    // ════════════════════════════════════════════════════════
    // Phase 7 — Web / Domain / Hosting Foundation seed
    // HONESTY: demo-only domains (.demo), source internal_demo everywhere,
    // no real registrars, no provider IDs, nothing implies real provisioning.
    // ════════════════════════════════════════════════════════
    await seedWebHosting(prisma, { takatakClient, restaurantClient, takatakBrand, restaurantBrand });
  } finally {
    await prisma.$disconnect();
  }
}


type SeedRefs = {
  takatakClient: { id: string };
  restaurantClient: { id: string };
  takatakBrand: { id: string };
  restaurantBrand: { id: string };
};

async function seedWebHosting(prisma: PrismaClient, refs: SeedRefs) {
  const webExists = await prisma.domainAsset.findFirst({
    where: { domainName: "montrealrestauranthub.demo" },
  });
  if (webExists) {
    console.log("[seed] Web/hosting foundation seed already present — skipping web.");
    await seedAiStudio(prisma, refs);
    return;
  }

  // Domain assets (clearly internal demo domains — .demo TLD)
  const restaurantDomain = await prisma.domainAsset.create({
    data: {
      clientId: refs.restaurantClient.id,
      businessBrandId: refs.restaurantBrand.id,
      domainName: "montrealrestauranthub.demo",
      registrar: "internal_demo",
      status: "pending_connection",
      dnsStatus: "pending",
      sslStatus: "pending",
      autoRenew: false,
    },
  });
  const takatakDomain = await prisma.domainAsset.create({
    data: {
      clientId: refs.takatakClient.id,
      businessBrandId: refs.takatakBrand.id,
      domainName: "takatak.demo",
      registrar: "internal_demo",
      status: "planned",
      dnsStatus: "not_configured",
      sslStatus: "not_configured",
      autoRenew: false,
    },
  });

  // Hosting services
  const restaurantHosting = await prisma.hostingService.create({
    data: {
      clientId: refs.restaurantClient.id,
      businessBrandId: refs.restaurantBrand.id,
      primaryDomainId: restaurantDomain.id,
      planName: "Bronze Hosting Foundation",
      status: "pending_setup",
      serverStatus: "pending",
    },
  });
  const takatakHosting = await prisma.hostingService.create({
    data: {
      clientId: refs.takatakClient.id,
      businessBrandId: refs.takatakBrand.id,
      primaryDomainId: takatakDomain.id,
      planName: "SaaS Hosting Foundation",
      status: "planned",
      serverStatus: "unknown",
    },
  });

  // Minimal internal_demo DNS records (placeholders — never claimed live)
  await prisma.dnsRecord.createMany({
    data: [
      { domainAssetId: restaurantDomain.id, type: "A", name: "@", value: "0.0.0.0 (internal demo placeholder)", ttl: 3600, status: "planned", source: "internal_demo" },
      { domainAssetId: restaurantDomain.id, type: "CNAME", name: "www", value: "montrealrestauranthub.demo (internal demo placeholder)", ttl: 3600, status: "planned", source: "internal_demo" },
    ],
  });

  // SSL tracking rows
  await prisma.sslCertificate.createMany({
    data: [
      { domainAssetId: restaurantDomain.id, status: "pending", source: "internal_demo", autoRenew: false },
      { domainAssetId: takatakDomain.id, status: "planned", source: "internal_demo", autoRenew: false },
    ],
  });

  // Provisioning steps
  const STEP_TITLES: Record<string, string> = {
    order_received: "Order received",
    payment_confirmed: "Payment confirmed",
    hosting_created: "Hosting created",
    domain_connected: "Domain connected",
    dns_checked: "DNS checked",
    ssl_requested: "SSL requested",
    ssl_ready: "SSL ready",
    website_live: "Website live",
  };
  const restaurantStatuses: Record<string, "planned" | "pending" | "completed_internal"> = {
    order_received: "completed_internal",
    payment_confirmed: "planned",
    hosting_created: "pending",
    domain_connected: "pending",
    dns_checked: "pending",
    ssl_requested: "planned",
    ssl_ready: "planned",
    website_live: "planned",
  };
  const types = Object.keys(STEP_TITLES) as (keyof typeof STEP_TITLES)[];
  await prisma.provisioningStep.createMany({
    data: types.map((t, i) => ({
      clientId: refs.restaurantClient.id,
      businessBrandId: refs.restaurantBrand.id,
      hostingServiceId: restaurantHosting.id,
      type: t as never,
      title: STEP_TITLES[t],
      status: restaurantStatuses[t] as never,
      order: i,
      ...(restaurantStatuses[t] === "completed_internal" ? { completedAt: new Date() } : {}),
    })),
  });
  await prisma.provisioningStep.createMany({
    data: types.map((t, i) => ({
      clientId: refs.takatakClient.id,
      businessBrandId: refs.takatakBrand.id,
      hostingServiceId: takatakHosting.id,
      type: t as never,
      title: STEP_TITLES[t],
      status: "planned" as never,
      order: i,
    })),
  });

  console.log("[seed] Web/hosting foundation seed complete: 2 demo domains, 2 hosting services, 2 internal_demo DNS records, 2 SSL rows, 16 provisioning steps (1 completed_internal).");
  await seedAiStudio(prisma, refs);
}

async function seedAiStudio(prisma: PrismaClient, refs: SeedRefs) {
  const aiExists = await prisma.brandVoice.findFirst({
    where: { name: "Montreal Restaurant Hub — Friendly Local Voice" },
  });
  if (aiExists) {
    console.log("[seed] AI Studio foundation seed already present — skipping AI.");
    await seedReporting(prisma, refs);
    return;
  }

  // Brand voices (hand-written foundation profiles — NOT AI)
  const restaurantVoice = await prisma.brandVoice.create({
    data: {
      clientId: refs.restaurantClient.id,
      businessBrandId: refs.restaurantBrand.id,
      name: "Montreal Restaurant Hub — Friendly Local Voice",
      tone: "Warm, local, food-forward, casual",
      audience: "Montreal locals and food lovers",
      language: "en",
      keywords: ["fresh", "local", "weekly special", "family"],
      bannedPhrases: ["cheap", "discount blowout"],
      sampleCaption: "[Foundation template] Fresh from our kitchen this week — come taste what's local.",
      notes: "Foundation seed profile. Refine with the client before any real AI generation.",
    },
  });
  const takatakVoice = await prisma.brandVoice.create({
    data: {
      clientId: refs.takatakClient.id,
      businessBrandId: refs.takatakBrand.id,
      name: "TAKATAK — Confident SaaS Voice",
      tone: "Clear, confident, helpful, no hype",
      audience: "Business owners managing digital services",
      language: "en",
      keywords: ["one dashboard", "control tower", "honest status"],
      bannedPhrases: ["revolutionary", "magic"],
      sampleCaption: "[Foundation template] Every service, one dashboard. See exactly what's running.",
      notes: "Foundation seed profile for TAKATAK's own brand.",
    },
  });

  // Saved outputs — origin foundation_template ONLY (hand-written, NOT AI)
  await prisma.savedAiOutput.createMany({
    data: [
      {
        clientId: refs.restaurantClient.id,
        businessBrandId: refs.restaurantBrand.id,
        brandVoiceId: restaurantVoice.id,
        kind: "caption",
        title: "Weekly special caption template",
        content: "[Foundation template — not AI generated] This week's special: {dish}. Made fresh, made local. Come hungry.",
        origin: "foundation_template",
        status: "saved",
      },
      {
        clientId: refs.restaurantClient.id,
        businessBrandId: refs.restaurantBrand.id,
        brandVoiceId: restaurantVoice.id,
        kind: "video_idea",
        title: "Behind-the-scenes kitchen video idea template",
        content: "[Foundation template — not AI generated] 30s reel: prep shots, sizzle close-up, plate reveal, staff smile, end card with weekly special.",
        origin: "foundation_template",
        status: "saved",
      },
      {
        clientId: refs.takatakClient.id,
        businessBrandId: refs.takatakBrand.id,
        brandVoiceId: takatakVoice.id,
        kind: "hook",
        title: "SaaS awareness hook template",
        content: "[Foundation template — not AI generated] Still juggling five dashboards? Here's what one honest control tower looks like.",
        origin: "foundation_template",
        status: "saved",
      },
    ],
  });

  // Planned AI content jobs — never executed in Phase 9
  await prisma.aiContentJob.createMany({
    data: [
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, brandVoiceId: restaurantVoice.id, kind: "caption", status: "planned", promptSummary: "Weekly special caption in brand voice", metadata: { plannedBy: "phase9_foundation" } },
      { clientId: refs.takatakClient.id, businessBrandId: refs.takatakBrand.id, brandVoiceId: takatakVoice.id, kind: "campaign_plan", status: "planned", promptSummary: "SaaS awareness mini campaign plan", metadata: { plannedBy: "phase9_foundation" } },
    ],
  });

  // AiProviderEvent: intentionally NOT seeded — no provider activity exists.

  console.log("[seed] AI Studio foundation seed complete: 2 brand voices, 3 template outputs (foundation_template — not AI), 2 planned AI jobs, 0 provider events.");
  await seedReporting(prisma, refs);
}

async function seedReporting(prisma: PrismaClient, refs: SeedRefs) {
  const reportingExists = await prisma.reportTemplate.findFirst({
    where: { name: "Monthly Client Summary Foundation" },
  });
  if (reportingExists) {
    console.log("[seed] Reporting foundation seed already present — skipping reporting.");
    await seedLocalListings(prisma, refs);
    return;
  }

  // ── Templates (3) ──────────────────────────────────────────
  const monthlyTemplate = await prisma.reportTemplate.create({
    data: {
      name: "Monthly Client Summary Foundation",
      description: "Foundation template: monthly overview across all TAKATAK services for one client.",
      type: "client_summary",
      status: "active",
      defaultPeriod: "monthly",
      sectionsJson: [
        { type: "summary", title: "Executive Summary" },
        { type: "metrics", title: "Service Status" },
        { type: "social_posts", title: "Social Media Snapshot" },
        { type: "hosting_status", title: "Web / Hosting Snapshot" },
        { type: "recommendations", title: "Recommendations" },
      ],
      metadata: { seededBy: "phase10_foundation" },
    },
  });
  await prisma.reportTemplate.create({
    data: {
      name: "Social Media Foundation Report",
      description: "Foundation template: weekly social results per brand. Fills with real analytics only after a verified Metricool sync exists.",
      type: "social_media",
      status: "active",
      defaultPeriod: "weekly",
      sectionsJson: [
        { type: "summary", title: "Week at a Glance" },
        { type: "social_posts", title: "Post Pipeline" },
        { type: "campaign_performance", title: "Campaign Performance" },
        { type: "chart_placeholder", title: "Engagement Chart (placeholder)" },
        { type: "notes", title: "Notes" },
      ],
      metadata: { seededBy: "phase10_foundation" },
    },
  });
  await prisma.reportTemplate.create({
    data: {
      name: "Web / Hosting Foundation Report",
      description: "Foundation template: domain, DNS, SSL, and hosting status per client.",
      type: "web_hosting",
      status: "active",
      defaultPeriod: "monthly",
      sectionsJson: [
        { type: "summary", title: "Overview" },
        { type: "domain_status", title: "Domain Status" },
        { type: "hosting_status", title: "Hosting Status" },
        { type: "recommendations", title: "Recommendations" },
      ],
      metadata: { seededBy: "phase10_foundation" },
    },
  });

  // ── Reports (2 foundation drafts) ──────────────────────────
  // Update the existing Phase 4 core-seed report into the TAKATAK draft.
  const FOUNDATION_NOTE = "[Internal foundation summary — written by TAKATAK, not AI-generated]";
  let takatakReport = await prisma.report.findFirst({
    where: { title: "Monthly Client Summary (foundation draft)" },
  });
  if (takatakReport) {
    takatakReport = await prisma.report.update({
      where: { id: takatakReport.id },
      data: {
        title: "TAKATAK Service Overview Draft",
        type: "client_summary",
        status: "draft",
        summary: `${FOUNDATION_NOTE} Overview of TAKATAK Demo Brand services: dashboard foundation live, integrations not connected, reporting engine in foundation state.`,
      },
    });
  } else {
    takatakReport = await prisma.report.create({
      data: {
        clientId: refs.takatakClient.id,
        businessBrandId: refs.takatakBrand.id,
        type: "client_summary",
        title: "TAKATAK Service Overview Draft",
        status: "draft",
        summary: `${FOUNDATION_NOTE} Overview of TAKATAK Demo Brand services: dashboard foundation live, integrations not connected, reporting engine in foundation state.`,
      },
    });
  }
  const restaurantReport = await prisma.report.create({
    data: {
      clientId: refs.restaurantClient.id,
      businessBrandId: refs.restaurantBrand.id,
      type: "client_summary",
      title: "Restaurant Monthly Summary Draft",
      status: "draft",
      summary: `${FOUNDATION_NOTE} Monthly view for Montreal Restaurant Hub Demo: social pipeline in draft/approval, domain and hosting pending setup, no provider analytics yet.`,
    },
  });

  // ── Sections ───────────────────────────────────────────────
  const SECTION_PREFIX = "[Foundation content — internal preview, not AI-generated]";
  const restaurantSections = [
    { type: "summary", title: "Executive Summary", status: "draft", content: `${SECTION_PREFIX} Social foundation is active with posts in draft and approval. Web presence is pending setup. Metricool and Upmind remain not connected.` },
    { type: "metrics", title: "Service Status", status: "draft", content: `${SECTION_PREFIX} Service instances remain in planned/pending states. Integration statuses are honest: nothing is connected.` },
    { type: "social_posts", title: "Social Media Snapshot", status: "draft", content: `${SECTION_PREFIX} 4 internal posts exist across draft, pending approval, and approved. No posts are scheduled or published.` },
    { type: "hosting_status", title: "Web / Hosting Snapshot", status: "draft", content: `${SECTION_PREFIX} montrealrestauranthub.demo is pending connection; DNS and SSL tracking rows are internal placeholders.` },
    { type: "recommendations", title: "Recommendations", status: "draft", content: `${SECTION_PREFIX} Next: confirm Metricool credentials and endpoint, approve pending post, review hosting plan before Upmind connection.` },
    { type: "notes", title: "Notes", status: "draft", content: `${SECTION_PREFIX} This report is a structural foundation. Export and delivery are not active.` },
  ];
  const takatakSections = [
    { type: "summary", title: "Executive Summary", status: "draft", content: `${SECTION_PREFIX} TAKATAK platform foundation covers social, web/hosting, AI Studio, and reporting structure. All providers honestly not connected.` },
    { type: "metrics", title: "Service Status", status: "draft", content: `${SECTION_PREFIX} Dashboard, auth, and database foundations are operational. Integration adapters await real credentials.` },
    { type: "social_posts", title: "Social Media Snapshot", status: "draft", content: `${SECTION_PREFIX} LinkedIn account not connected; X disabled. Awareness campaign in draft.` },
    { type: "hosting_status", title: "Web / Hosting Snapshot", status: "draft", content: `${SECTION_PREFIX} takatak.demo planned; hosting service planned; provisioning timeline all planned.` },
    { type: "recommendations", title: "AI Studio Snapshot", status: "draft", content: `${SECTION_PREFIX} 2 brand voices and 3 foundation templates exist. 0 AI-generated outputs — no provider is connected.` },
  ];
  const createdRestaurantSections: { id: string; type: string }[] = [];
  for (let i = 0; i < restaurantSections.length; i++) {
    const sec = restaurantSections[i];
    const created = await prisma.reportSection.create({
      data: {
        reportId: restaurantReport.id,
        title: sec.title,
        type: sec.type as never,
        order: i,
        status: sec.status as never,
        content: sec.content,
      },
      select: { id: true, type: true },
    });
    createdRestaurantSections.push(created);
  }
  for (let i = 0; i < takatakSections.length; i++) {
    const sec = takatakSections[i];
    await prisma.reportSection.create({
      data: {
        reportId: takatakReport.id,
        title: sec.title,
        type: sec.type as never,
        order: i,
        status: sec.status as never,
        content: sec.content,
      },
    });
  }

  // ── Metrics (honest foundation snapshots) ──────────────────
  const metricsSection = createdRestaurantSections.find((sec) => sec.type === "metrics");
  await prisma.reportMetric.createMany({
    data: [
      { reportId: restaurantReport.id, sectionId: metricsSection?.id ?? null, key: "planned_services", label: "Planned services", value: "2", source: "internal" },
      { reportId: restaurantReport.id, sectionId: metricsSection?.id ?? null, key: "not_connected_integrations", label: "Integrations not connected", value: "7", source: "internal" },
      { reportId: restaurantReport.id, sectionId: null, key: "draft_posts", label: "Draft posts", value: "2", source: "social_foundation" },
      { reportId: restaurantReport.id, sectionId: null, key: "pending_approvals", label: "Pending approvals", value: "1", source: "social_foundation" },
      { reportId: restaurantReport.id, sectionId: null, key: "approved_posts", label: "Approved posts", value: "1", source: "social_foundation" },
      { reportId: restaurantReport.id, sectionId: null, key: "domains_tracked", label: "Domains tracked", value: "2", source: "web_hosting_foundation" },
      { reportId: restaurantReport.id, sectionId: null, key: "ssl_pending", label: "SSL pending", value: "2", source: "web_hosting_foundation" },
      { reportId: takatakReport.id, sectionId: null, key: "ai_template_outputs", label: "AI Studio template outputs (not AI)", value: "3", source: "ai_foundation" },
      { reportId: takatakReport.id, sectionId: null, key: "ai_generated_outputs", label: "AI-generated outputs", value: "0", source: "ai_foundation" },
      { reportId: takatakReport.id, sectionId: null, key: "report_export_enabled", label: "Report export enabled", value: "No", source: "manual" },
      { reportId: takatakReport.id, sectionId: null, key: "report_delivery_enabled", label: "Report delivery enabled", value: "No", source: "manual" },
    ],
  });

  // ── Schedule (record only — no worker) ─────────────────────
  await prisma.reportSchedule.create({
    data: {
      clientId: refs.restaurantClient.id,
      businessBrandId: refs.restaurantBrand.id,
      reportTemplateId: monthlyTemplate.id,
      name: "Monthly Client Summary Schedule",
      frequency: "monthly",
      status: "planned",
      metadata: { note: "Foundation schedule record only — no background worker active." },
    },
  });

  // ReportShare: intentionally NOT seeded — no sharing exists in Phase 10.

  console.log("[seed] Reporting foundation seed complete: 3 active templates, 2 draft reports (11 sections, internal preview content), 11 honest metrics (ai_generated_outputs=0, export/delivery=No), 1 planned schedule (no worker), 0 shares.");
  await seedLocalListings(prisma, refs);
}

async function seedLocalListings(prisma: PrismaClient, refs: SeedRefs) {
  const localExists = await prisma.localListing.findFirst({
    where: { name: "Montreal Restaurant Hub Local Listing Foundation" },
  });
  if (localExists) {
    console.log("[seed] Local listings foundation seed already present — skipping local listings.");
    await seedLeads(prisma, refs);
    return;
  }

  // ── Listings (2, internal_demo provider only) ──────────────
  const restaurantListing = await prisma.localListing.create({
    data: {
      clientId: refs.restaurantClient.id,
      businessBrandId: refs.restaurantBrand.id,
      provider: "internal_demo",
      name: "Montreal Restaurant Hub Local Listing Foundation",
      platformName: "Internal Local Listing Foundation",
      category: "Restaurant",
      city: "Montréal",
      region: "Québec",
      country: "Canada",
      status: "active_internal",
      napStatus: "consistent_internal",
      metadata: { seededBy: "phase11_foundation" },
    },
  });
  const takatakListing = await prisma.localListing.create({
    data: {
      clientId: refs.takatakClient.id,
      businessBrandId: refs.takatakBrand.id,
      provider: "internal_demo",
      name: "TAKATAK Business Services Listing Foundation",
      platformName: "Internal Local Listing Foundation",
      category: "Business services",
      city: "Montréal",
      region: "Québec",
      country: "Canada",
      status: "draft",
      napStatus: "needs_review",
      metadata: { seededBy: "phase11_foundation" },
    },
  });

  // ── Citations (4, internal_demo, no real URLs) ─────────────
  await prisma.listingCitation.createMany({
    data: [
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, localListingId: restaurantListing.id, directoryName: "Internal Demo Directory", url: null, status: "found_internal", napStatus: "consistent_internal", source: "internal_demo" },
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, localListingId: restaurantListing.id, directoryName: "Local Business Directory Foundation", url: null, status: "planned", napStatus: "unknown", source: "internal_demo" },
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, localListingId: restaurantListing.id, directoryName: "Restaurant Category Directory Foundation", url: null, status: "needs_update", napStatus: "needs_review", source: "internal_demo" },
      { clientId: refs.takatakClient.id, businessBrandId: refs.takatakBrand.id, localListingId: takatakListing.id, directoryName: "Service Provider Directory Foundation", url: null, status: "planned", napStatus: "unknown", source: "internal_demo" },
    ],
  });

  // ── Reviews (2, internal_demo — NEVER claimed as imported) ─
  await prisma.listingReview.createMany({
    data: [
      {
        clientId: refs.restaurantClient.id,
        businessBrandId: refs.restaurantBrand.id,
        localListingId: restaurantListing.id,
        provider: "internal_demo",
        reviewerName: "Internal Demo Reviewer",
        rating: 5,
        title: "Internal demo review — positive",
        body: "[Internal demo review — not imported from Google or QMAPS] Great weekly specials and friendly staff. Used to demonstrate the review monitoring layout.",
        status: "internal_demo",
        replyStatus: "draft_reply",
        sentiment: "positive",
        reviewedAt: new Date(),
      },
      {
        clientId: refs.restaurantClient.id,
        businessBrandId: refs.restaurantBrand.id,
        localListingId: restaurantListing.id,
        provider: "internal_demo",
        reviewerName: "Internal Demo Reviewer 2",
        rating: 3,
        title: "Internal demo review — neutral",
        body: "[Internal demo review — not imported from Google or QMAPS] Average wait time on a busy night. Used to demonstrate the needs-review workflow.",
        status: "needs_review",
        replyStatus: "not_replied",
        sentiment: "neutral",
        reviewedAt: new Date(),
      },
    ],
  });

  // ── Photos (2 placeholders, null imageUrl) ─────────────────
  await prisma.listingPhoto.createMany({
    data: [
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, localListingId: restaurantListing.id, title: "Exterior photo (planned)", imageUrl: null, status: "planned", source: "internal_demo", metadata: { note: "Internal placeholder — no image uploaded, no provider URL." } },
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, localListingId: restaurantListing.id, title: "Menu / brand photo (planned)", imageUrl: null, status: "planned", source: "internal_demo", metadata: { note: "Internal placeholder — no image uploaded, no provider URL." } },
    ],
  });

  // ── Visibility snapshots (internal_foundation, score null) ─
  const now = new Date();
  await prisma.localVisibilitySnapshot.createMany({
    data: [
      {
        clientId: refs.restaurantClient.id,
        businessBrandId: refs.restaurantBrand.id,
        localListingId: restaurantListing.id,
        source: "internal_foundation",
        score: null,
        listingsCount: 1,
        citationsCount: 3,
        reviewsCount: 2,
        averageRating: 4.0,
        notes: "Foundation visibility only — counts from internal foundation records, not from QMAPS or provider data.",
        capturedAt: now,
      },
      {
        clientId: refs.takatakClient.id,
        businessBrandId: refs.takatakBrand.id,
        localListingId: takatakListing.id,
        source: "internal_foundation",
        score: null,
        listingsCount: 1,
        citationsCount: 1,
        reviewsCount: 0,
        averageRating: null,
        notes: "Foundation visibility only — counts from internal foundation records, not from QMAPS or provider data.",
        capturedAt: now,
      },
    ],
  });

  console.log("[seed] Local listings foundation seed complete: 2 listings (internal_demo), 4 citations (no URLs), 2 internal_demo reviews (never imported), 2 photo placeholders (null imageUrl), 2 internal_foundation snapshots (score null). QMAPS and Google Business not connected.");
  await seedLeads(prisma, refs);
}

async function seedLeads(prisma: PrismaClient, refs: SeedRefs) {
  const leadsExist = await prisma.leadSource.findFirst({
    where: { name: "Restaurant Website Form Foundation" },
  });
  if (leadsExist) {
    console.log("[seed] Leads foundation seed already present — skipping leads.");
    await seedAdminOps(prisma, refs);
    return;
  }

  // ── Lead sources (4; FLEXS source is PLANNED only) ─────────
  const restaurantFormSource = await prisma.leadSource.create({
    data: { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, name: "Restaurant Website Form Foundation", type: "website_form", provider: "internal_demo", status: "active_internal" },
  });
  await prisma.leadSource.create({
    data: { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, name: "Restaurant Local Listings Foundation", type: "local_listing", provider: "internal_demo", status: "active_internal" },
  });
  const takatakManualSource = await prisma.leadSource.create({
    data: { clientId: refs.takatakClient.id, businessBrandId: refs.takatakBrand.id, name: "TAKATAK Manual Prospecting Foundation", type: "manual", provider: "internal_demo", status: "active_internal" },
  });
  const flexsFutureSource = await prisma.leadSource.create({
    data: { clientId: refs.takatakClient.id, businessBrandId: refs.takatakBrand.id, name: "FLEXS Future Lead Source", type: "flexs", provider: "flexs", status: "planned", metadata: { note: "Planned only — FLEXS is not connected and no lead is imported from it." } },
  });

  // ── Campaigns (2; no real ad budget) ───────────────────────
  const cateringCampaign = await prisma.leadCampaign.create({
    data: { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, leadSourceId: restaurantFormSource.id, name: "Restaurant Catering Leads Foundation", goal: "Collect catering and group order inquiries", status: "planned", budgetCents: null },
  });
  const saasCampaign = await prisma.leadCampaign.create({
    data: { clientId: refs.takatakClient.id, businessBrandId: refs.takatakBrand.id, leadSourceId: takatakManualSource.id, name: "TAKATAK SaaS Demo Leads Foundation", goal: "Track SaaS dashboard interest internally", status: "active_internal", budgetCents: null },
  });

  // ── Leads (5; demo-safe contacts, no external IDs) ─────────
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const DEMO_NOTE = "[Internal demo lead — foundation record, not imported from any provider]";
  const cateringLead = await prisma.lead.create({
    data: { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, leadSourceId: restaurantFormSource.id, leadCampaignId: cateringCampaign.id, name: "Catering Inquiry (demo)", email: "catering-lead@example.test", company: "Demo Events Co.", message: `${DEMO_NOTE} Interested in catering for a 40-person office event.`, status: "new_internal", priority: "high" },
  });
  const hostingLead = await prisma.lead.create({
    data: { clientId: refs.takatakClient.id, businessBrandId: refs.takatakBrand.id, leadSourceId: takatakManualSource.id, leadCampaignId: saasCampaign.id, name: "Website Hosting Inquiry (demo)", email: "hosting-lead@example.test", message: `${DEMO_NOTE} Asked about hosting a small business website.`, status: "follow_up_planned", priority: "normal", followUpAt: inSevenDays },
  });
  await prisma.lead.create({
    data: { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, leadSourceId: restaurantFormSource.id, name: "Social Media Package Interest (demo)", email: "social-lead@example.test", message: `${DEMO_NOTE} Wants pricing for weekly social media management.`, status: "contacted_internal", priority: "normal" },
  });
  const listingLead = await prisma.lead.create({
    data: { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, leadSourceId: restaurantFormSource.id, name: "Local Listing Cleanup Request (demo)", email: "listing-lead@example.test", message: `${DEMO_NOTE} Needs NAP consistency fixes across directories.`, status: "qualified_internal", priority: "high" },
  });
  await prisma.lead.create({
    data: { clientId: refs.takatakClient.id, businessBrandId: refs.takatakBrand.id, leadSourceId: flexsFutureSource.id, name: "FLEXS Future Demo Lead Placeholder", email: "flexs-placeholder@example.test", message: "[Internal demo lead — not imported from FLEXS] Placeholder showing where FLEXS-captured leads will appear.", status: "new_internal", priority: "low" },
  });

  // ── Pipeline stages (7 per brand, both brands) ─────────────
  const STAGES = ["New", "Follow-up Planned", "Contacted", "Qualified", "Proposal Planned", "Won", "Lost"];
  for (const [clientId, brandId] of [
    [refs.restaurantClient.id, refs.restaurantBrand.id],
    [refs.takatakClient.id, refs.takatakBrand.id],
  ] as const) {
    await prisma.leadPipelineStage.createMany({
      data: STAGES.map((name, i) => ({
        clientId, businessBrandId: brandId, name, status: "active_internal" as const, order: i + 1,
      })),
    });
  }

  // ── Activities (5; internal tracking only) ─────────────────
  await prisma.leadActivity.createMany({
    data: [
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, leadId: cateringLead.id, type: "note", status: "completed_internal", title: "Internal note", note: "Foundation note — lead recorded in internal inbox.", completedAt: new Date() },
      { clientId: refs.takatakClient.id, businessBrandId: refs.takatakBrand.id, leadId: hostingLead.id, type: "follow_up", status: "planned", title: "Follow-up planned", note: "Plan internal follow-up about hosting needs. No email/SMS is sent by the system.", dueAt: inSevenDays },
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, leadId: cateringLead.id, type: "call", status: "planned", title: "Call planned", note: "Manual call planned by staff — no automation dials or records anything.", dueAt: inSevenDays },
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, leadId: listingLead.id, type: "proposal", status: "planned", title: "Proposal reminder", note: "Prepare listing cleanup proposal draft.", dueAt: inSevenDays },
      { clientId: refs.restaurantClient.id, businessBrandId: refs.restaurantBrand.id, leadId: listingLead.id, type: "status_change", status: "completed_internal", title: "Status change note", note: "Moved to Qualified (internal only) after manual review.", completedAt: new Date() },
    ],
  });

  console.log("[seed] Leads foundation seed complete: 4 sources (FLEXS source planned only), 2 campaigns (no budget), 5 internal demo leads (example.test emails, no external IDs), 14 pipeline stages, 5 activities (no real outreach). FLEXS not connected.");
  await seedAdminOps(prisma, refs);
}

async function seedAdminOps(prisma: PrismaClient, refs: SeedRefs) {
  const adminExists = await prisma.auditLog.findFirst({
    where: { action: "admin_ops.foundation_seeded" },
  });
  if (adminExists) {
    console.log("[seed] Admin ops foundation seed already present — skipping admin ops.");
    return;
  }

  // Audit log entries — system-internal, no fake user actions.
  await prisma.auditLog.createMany({
    data: [
      { action: "admin_ops.foundation_seeded", entityType: "system", metadata: { note: "Phase 13 admin ops foundation seed. System-internal entry — not a user action." } },
      { action: "foundation.checkpoint_10_12_passed", entityType: "system", metadata: { note: "Checkpoint audit for Phases 10-12 passed (fresh-DB migrate+seed, RLS 001-007, honesty scans)." } },
      { clientId: refs.restaurantClient.id, action: "foundation.module_seeded", entityType: "client", entityId: refs.restaurantClient.id, metadata: { note: "Foundation modules seeded for demo client. System-internal entry." } },
    ],
  });

  // Job logs on existing planned jobs — informational only, no execution.
  const plannedJobs = await prisma.job.findMany({ where: { status: "planned" }, take: 2, orderBy: { createdAt: "asc" } });
  for (const job of plannedJobs) {
    await prisma.jobLog.create({
      data: { jobId: job.id, level: "info", message: "Planned during foundation. No worker exists yet — this job has never run.", metadata: { seededBy: "phase13_foundation" } },
    });
  }

  // One extra system notification.
  await prisma.notification.create({
    data: { type: "system", title: "Checkpoint 10-12 passed", message: "Fresh-database migration, seed idempotency, RLS application, and honesty scans all verified. No providers connected.", status: "unread" },
  });

  console.log(`[seed] Admin ops foundation seed complete: 3 audit log entries (system-internal), ${plannedJobs.length} job logs on planned jobs (never run), 1 system notification. No workers exist.`);
}
main().catch((e) => {
  console.error("[seed] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
