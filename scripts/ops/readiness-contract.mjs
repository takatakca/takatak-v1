/**
 * /api/health/ready is a mandatory-service traffic gate, not a simple
 * liveness badge. An HTTP error carrying {ok:true}, or a response without
 * strictly healthy database and Supabase checks, must not pass.
 *
 * Pure helper so the live probe can be tested without network access.
 */
export function assessLiveReadiness({ status, json }) {
  if (status !== 200) {
    return { ok: false, reason: `HTTP ${Number.isInteger(status) ? status : "unknown"}` };
  }
  if (json?.ok !== true) {
    return { ok: false, reason: "readiness payload missing ok=true" };
  }
  if (
    json.checks?.process !== "ok" ||
    json.checks?.database !== "ok" ||
    json.checks?.supabase !== "ok"
  ) {
    return { ok: false, reason: "required process/database/Supabase check not ok" };
  }
  return { ok: true, reason: "HTTP 200, process/database/Supabase ok" };
}
