import { apiPost } from "./api-client";

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

export async function createDomainRequest(
  input: DomainRequestInput,
): Promise<StoredDomainRequest> {
  try {
    const res = await Promise.race([
      apiPost<{ request: StoredDomainRequest }>("/domain-requests", input),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("domain_request_timeout")), 3500),
      ),
    ]);
    return res.request;
  } catch {
    return saveLocalRequest(input);
  }
}
