// Website ownership verification — pure helpers (no I/O; safe for QA scripts).
//
// A workspace proves it controls a tracked website's domain by publishing its
// own per-site token, either as a DNS TXT record on the domain or as a meta
// tag in the <head> of the homepage. Google sources (GA4, Search Console) can
// only be linked to verified websites.

export const SITE_VERIFICATION_NAME = "takatak-site-verification";
export const VERIFICATION_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function verificationTxtValue(token: string): string {
  return `${SITE_VERIFICATION_NAME}=${token}`;
}

export function verificationMetaTag(token: string): string {
  return `<meta name="${SITE_VERIFICATION_NAME}" content="${token}">`;
}

/** resolveTxt() returns each record as an array of chunks. */
export function txtRecordsHaveVerification(records: string[][], token: string): boolean {
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) return false;
  const expected = verificationTxtValue(token);
  return records.some((chunks) => chunks.join("").trim() === expected);
}

function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) attrs[match[1].toLowerCase()] = (match[2] ?? match[3] ?? match[4] ?? "").trim();
  return attrs;
}

/** Only the document <head> counts, so page content (e.g. comments) cannot verify. */
export function htmlHasVerificationMeta(html: string, token: string): boolean {
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) return false;
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, " ");
  const headEnd = withoutComments.search(/<\/head\s*>|<body[\s>]/i);
  if (headEnd < 0) return false;
  const head = withoutComments.slice(0, headEnd);
  return Array.from(head.matchAll(/<meta\b[^>]*>/gi)).some((m) => {
    const attrs = attributes(m[0]);
    return attrs.name?.toLowerCase() === SITE_VERIFICATION_NAME && attrs.content === token;
  });
}
