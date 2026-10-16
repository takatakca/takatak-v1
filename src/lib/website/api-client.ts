export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, status: number) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (typeof fetch !== "function") {
    throw new ApiError("unavailable", 0);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("unavailable", 0);
  }

  const payload = (await response.json().catch(() => null)) as { code?: unknown; ok?: unknown } | null;
  const code = typeof payload?.code === "string" ? payload.code : "request_failed";
  if (!response.ok || payload?.ok === false) {
    throw new ApiError(code, response.status);
  }
  return payload as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}
