import "server-only";

import { timingSafeEqual } from "node:crypto";

export const WEB_SITE_VERIFICATION_META_NAME = "takatak-site-verification";

export function buildSiteVerificationMetaTag(token: string): string {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    throw new Error("Website verification token is invalid.");
  }

  return `<meta name="${WEB_SITE_VERIFICATION_META_NAME}" content="${token}" />`;
}

function tokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readAttribute(tag: string, name: string): string | null {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`,
    "i",
  );
  const match = tag.match(pattern);
  if (!match) return null;
  const value = match[1] ?? match[2] ?? match[3] ?? "";
  return value.trim();
}

export function pageContainsVerificationToken(
  html: string,
  token: string,
): boolean {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return false;

  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const tags = withoutComments.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const name =
      readAttribute(tag, "name") ?? readAttribute(tag, "property");
    if (name?.toLowerCase() !== WEB_SITE_VERIFICATION_META_NAME) continue;
    const content = readAttribute(tag, "content");
    if (content && tokensMatch(content, token)) return true;
  }

  return false;
}
