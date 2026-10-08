// Browser helper for public website requests. Sends the form to TAKATAK's
// own server (same origin) so it is recorded as a Lead. Callers keep their
// previous local fallback when the intake is not enabled or unreachable.

export type WebsiteRequestPayload =
  | {
      kind: "domain_request";
      domain: string;
      tld: string;
      name?: string;
      email?: string;
      phone?: string;
      message?: string;
      language?: "en" | "fr";
      sourcePage?: string;
      website?: string;
    }
  | {
      kind: "project_request";
      title: string;
      company?: string;
      category?: string;
      budget?: string;
      timeline?: string;
      message?: string;
      name?: string;
      email?: string;
      phone?: string;
      language?: "en" | "fr";
      sourcePage?: string;
      website?: string;
    }
  | {
      kind: "hosting_request";
      planName: string;
      name?: string;
      email?: string;
      phone?: string;
      message?: string;
      language?: "en" | "fr";
      sourcePage?: string;
      website?: string;
    }
  | {
      kind: "package_order";
      packageId: string;
      tierName: string;
      addons?: string[];
      promoCode?: string;
      name?: string;
      email?: string;
      phone?: string;
      message?: string;
      language?: "en" | "fr";
      sourcePage?: string;
      website?: string;
    };

export type WebsiteRequestResult =
  | { status: "sent"; reference: string; totalCents?: number; uploadToken?: string }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "rate_limited" }
  | { status: "unavailable" };

const TIMEOUT_MS = 8_000;

export async function submitWebsiteRequest(
  payload: WebsiteRequestPayload,
): Promise<WebsiteRequestResult> {
  let response: Response;
  try {
    response = await fetch("/api/public/website-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { status: "unavailable" };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON answer is treated as unavailable below */
  }

  if (response.ok && body.ok === true && typeof body.reference === "string") {
    return {
      status: "sent",
      reference: body.reference,
      ...(typeof body.totalCents === "number" ? { totalCents: body.totalCents } : {}),
      ...(typeof body.uploadToken === "string" ? { uploadToken: body.uploadToken } : {}),
    };
  }
  if (response.status === 400 && body.fieldErrors && typeof body.fieldErrors === "object") {
    return { status: "invalid", fieldErrors: body.fieldErrors as Record<string, string> };
  }
  if (response.status === 429) return { status: "rate_limited" };
  return { status: "unavailable" };
}

export type AttachmentUploadResult =
  | { status: "uploaded" }
  | { status: "rejected"; code: string }
  | { status: "failed" };

/** Sends one reference file for a request that returned an upload token. */
export async function uploadWebsiteAttachment(
  uploadToken: string,
  file: File,
): Promise<AttachmentUploadResult> {
  const form = new FormData();
  form.set("token", uploadToken);
  form.set("file", file);
  try {
    const response = await fetch("/api/public/website-requests/attachments", {
      method: "POST",
      body: form,
      credentials: "same-origin",
      signal: AbortSignal.timeout(60_000),
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; code?: string };
    if (response.ok && body.ok) return { status: "uploaded" };
    if (response.status >= 400 && response.status < 500) return { status: "rejected", code: body.code ?? "rejected" };
    return { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}
