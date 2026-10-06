// Website lead capture — server configuration. Disabled unless explicitly
// enabled and pointed at the TAKATAK agency workspace (a Client id) that
// owns inbound website requests.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,24}$/i;

export type WebsiteLeadsConfig =
  | { enabled: false }
  | {
      enabled: true;
      clientId: string;
      /** Internal TAKATAK address alerted for each new lead; null = in-app only. */
      notifyEmail: string | null;
      /** File attachments on project requests; null = uploads off. */
      uploads: { secret: string; bucket: string } | null;
    };

const BUCKET_RE = /^[a-z0-9][a-z0-9._-]{2,62}$/;

export function readWebsiteLeadsConfig(
  env: Record<string, string | undefined> = process.env,
): WebsiteLeadsConfig {
  if (env.WEBSITE_LEADS_ENABLED?.trim() !== "true") return { enabled: false };
  const clientId = env.WEBSITE_LEADS_CLIENT_ID?.trim() ?? "";
  if (!UUID_RE.test(clientId)) return { enabled: false };
  const notifyEmail = env.WEBSITE_LEADS_NOTIFY_EMAIL?.trim() ?? "";
  const uploadSecret = env.WEBSITE_LEADS_UPLOAD_SECRET?.trim() ?? "";
  const uploadBucket = env.WEBSITE_LEADS_UPLOAD_BUCKET?.trim() || "website-lead-attachments";
  return {
    enabled: true,
    clientId: clientId.toLowerCase(),
    notifyEmail: EMAIL_RE.test(notifyEmail) ? notifyEmail.toLowerCase() : null,
    uploads:
      uploadSecret.length >= 32 && BUCKET_RE.test(uploadBucket)
        ? { secret: uploadSecret, bucket: uploadBucket }
        : null,
  };
}
