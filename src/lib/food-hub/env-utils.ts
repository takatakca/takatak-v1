// Small environment helpers shared by the Food Hub connectors.
export function missingEnv(required: string[]): string[] {
  return required.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
}

export function liveConnectorsGloballyEnabled(): boolean {
  return process.env.LIVE_CONNECTORS_GLOBAL_ENABLED === 'true';
}

export function timeoutMs(): number {
  const raw = Number(process.env.CONNECTOR_NETWORK_TIMEOUT_MS || 15000);
  return Number.isFinite(raw) && raw > 0 ? raw : 15000;
}

export async function timedFetch(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
