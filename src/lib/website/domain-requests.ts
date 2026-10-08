import { submitWebsiteRequest } from "./website-requests";

export interface DomainRequestInput {
  domain: string;
  tld: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  source?: string;
}

export interface StoredDomainRequest extends DomainRequestInput {
  id: string;
  status: "new" | "checking" | "available" | "unavailable" | "registered" | "cancelled";
  createdAt: string;
  localOnly?: boolean;
}

const STORAGE_KEY = "takatak:domain-requests";

function localRequests(): StoredDomainRequest[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredDomainRequest[];
  } catch {
    return [];
  }
}

function saveLocalRequest(input: DomainRequestInput): StoredDomainRequest {
  const request: StoredDomainRequest = {
    ...input,
    id: `local-${Date.now()}`,
    status: "new",
    createdAt: new Date().toISOString(),
    localOnly: true,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([request, ...localRequests()].slice(0, 20)),
    );
  }
  return request;
}

/**
 * Sends the request to TAKATAK (recorded as a Lead). When the intake is not
 * enabled or unreachable, the request is kept locally as before.
 */
export async function createDomainRequest(
  input: DomainRequestInput,
  options: { language?: "en" | "fr" } = {},
): Promise<StoredDomainRequest> {
  const result = await submitWebsiteRequest({
    kind: "domain_request",
    domain: input.domain,
    tld: input.tld,
    name: input.contactName,
    email: input.contactEmail,
    phone: input.contactPhone,
    message: input.source ? `Source: ${input.source}` : undefined,
    language: options.language,
    sourcePage:
      typeof window !== "undefined" ? window.location.pathname : undefined,
  });

  if (result.status === "sent") {
    return {
      ...input,
      id: result.reference,
      status: "new",
      createdAt: new Date().toISOString(),
      localOnly: false,
    };
  }
  return saveLocalRequest(input);
}
