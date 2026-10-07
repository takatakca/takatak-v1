import Redis from "ioredis";

const REDIS_PROTOCOLS = new Set(["redis:", "rediss:"]);

export function readRedisUrl(): string | null {
  const value = process.env.REDIS_URL?.trim() ?? "";
  return value.length > 0 ? value : null;
}

/** Returns a stable message. Never includes the URL, password, or host. */
export function redisUrlProblem(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "REDIS_URL is not a valid URL";
  }
  if (!REDIS_PROTOCOLS.has(parsed.protocol)) {
    return "REDIS_URL must use redis:// or rediss://";
  }
  if (!parsed.hostname || parsed.hostname === "0.0.0.0") {
    return "REDIS_URL host is not allowed";
  }
  return null;
}

export function assertRedisConfigured(): void {
  const url = readRedisUrl();
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  const problem = redisUrlProblem(url);
  if (problem) {
    throw new Error(problem);
  }
}

export function createRedisClient(): Redis {
  assertRedisConfigured();
  const url = readRedisUrl();
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 5_000,
    connectionName: "takatak",
    lazyConnect: true,
  });
}

export function bullmqConnection(): {
  url: string;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
  connectTimeout: number;
  connectionName: string;
} {
  assertRedisConfigured();
  const url = readRedisUrl();
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return {
    url,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 5_000,
    connectionName: "takatak",
  };
}

export async function readRedisReadiness(): Promise<
  "ok" | "unavailable" | "not_configured"
> {
  const url = readRedisUrl();
  if (!url) {
    return "not_configured";
  }
  if (redisUrlProblem(url)) {
    return "unavailable";
  }

  const client = createRedisClient();
  try {
    await client.connect();
    const pong = await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), 1_500);
      }),
    ]);
    return pong === "PONG" ? "ok" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    client.disconnect();
  }
}
