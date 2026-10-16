"use strict";

// Coolify's web process must not report healthy with an unconfigured database
// or Supabase admin auth. The public /api/health endpoint is intentionally
// permissive; the container health check is not.
const port = process.env.PORT || "3000";
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

(async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`ready HTTP ${response.status}`);
    const data = await response.json();
    if (
      data?.ok !== true ||
      data?.checks?.process !== "ok" ||
      data?.checks?.database !== "ok" ||
      data?.checks?.supabase !== "ok"
    ) throw new Error("database or Supabase not ready");
    process.exitCode = 0;
  } catch (error) {
    console.error("TAKATAK readiness:", error?.message || "unavailable");
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
})();
