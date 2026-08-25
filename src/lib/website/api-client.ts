export async function apiGet<T>(_path: string): Promise<T> {
  throw new Error("not_configured");
}

export async function apiPost<T>(_path: string, _body?: unknown): Promise<T> {
  throw new Error("not_configured");
}
