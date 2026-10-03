import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AHMV_WEBSITE = "https://ahmverdun.ca";
const AHMV_FACEBOOK_URL = "https://www.facebook.com/ahmverdun.ca";
const ALLOWED_ORIGINS = new Set([
  "https://ahmverdun.ca",
  "https://www.ahmverdun.ca",
]);

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function sourceKind(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>).sourceKind;
  return typeof value === "string" ? value : null;
}

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin");
  const allowLocal =
    process.env.NODE_ENV !== "production" &&
    origin != null &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  const headers: Record<string, string> = {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
  };

  if (origin && (ALLOWED_ORIGINS.has(origin) || allowLocal)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

export async function OPTIONS(request: NextRequest) {
  const headers = {
    ...corsHeaders(request),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  return new NextResponse(null, { status: 204, headers });
}

/**
 * Public, read-only AHMV Facebook feed.
 *
 * Only presentation-safe fields are exposed. Meta Page IDs, provider object IDs,
 * access tokens, internal brand/account IDs, analytics and credentials never
 * leave TAKATAK.
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(request);
  const prisma = getPrisma();

  if (!prisma) {
    return NextResponse.json(
      {
        ok: true,
        connected: false,
        page: { name: "AHM Verdun", url: AHMV_FACEBOOK_URL },
        items: [],
      },
      { status: 200, headers },
    );
  }

  const brand = await prisma.businessBrand.findFirst({
    where: {
      website: AHMV_WEBSITE,
      status: "active",
    },
    select: {
      id: true,
      clientId: true,
    },
  });

  if (!brand) {
    return NextResponse.json(
      {
        ok: true,
        connected: false,
        page: { name: "AHM Verdun", url: AHMV_FACEBOOK_URL },
        items: [],
      },
      { status: 200, headers },
    );
  }

  const account = await prisma.socialAccount.findFirst({
    where: {
      clientId: brand.clientId,
      businessBrandId: brand.id,
      platform: "facebook",
      status: "connected",
      accessStatus: "selected",
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!account) {
    return NextResponse.json(
      {
        ok: true,
        connected: false,
        page: { name: "AHM Verdun", url: AHMV_FACEBOOK_URL },
        items: [],
      },
      { status: 200, headers },
    );
  }

  const rows = await prisma.socialContentItem.findMany({
    where: {
      clientId: brand.clientId,
      businessBrandId: brand.id,
      socialAccountId: account.id,
      availability: "available",
      deletedAt: null,
      contentType: { in: ["post", "reel"] },
      publishedAt: { lte: new Date() },
    },
    orderBy: { publishedAt: "desc" },
    take: 12,
    select: {
      id: true,
      contentType: true,
      publishedAt: true,
      captionExcerpt: true,
      permalinkUrl: true,
      thumbnailUrl: true,
      metadata: true,
    },
  });

  const items = rows.map((row) => {
    const kind = sourceKind(row.metadata);
    return {
      id: row.id,
      source: kind === "page_tagged" ? "community" : "official",
      network: "facebook" as const,
      contentType: row.contentType,
      publishedAt: row.publishedAt.toISOString(),
      text: row.captionExcerpt,
      url: safeHttpsUrl(row.permalinkUrl),
      imageUrl: safeHttpsUrl(row.thumbnailUrl),
    };
  });

  return NextResponse.json(
    {
      ok: true,
      connected: true,
      page: { name: "AHM Verdun", url: AHMV_FACEBOOK_URL },
      updatedAt: new Date().toISOString(),
      items,
    },
    { status: 200, headers },
  );
}
