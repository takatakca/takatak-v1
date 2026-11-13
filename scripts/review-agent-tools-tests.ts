import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  authenticateReviewAgent,
  handleReviewMcp,
  type ReviewAgentDependencies,
} from "../src/lib/reputation/agent-tools";
import type { TenantAccess } from "../src/lib/security/tenant-access";
import type {
  CockpitSnapshot,
  ReviewRecord,
} from "../src/lib/reputation/cockpit-model";

const tenant = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const actor = "33333333-3333-4333-8333-333333333333";
const now = Date.parse("2026-11-01T12:00:00.000Z");
const token = "synthetic-review-agent-test-token-00000001";
const grant = {
  tokenSha256: createHash("sha256").update(token).digest("hex"),
  clientId: tenant,
  profileId: actor,
  expiresAt: "2026-11-02T12:00:00.000Z",
};
const access: Extract<TenantAccess, { mode: "client_scoped" }> = {
  mode: "client_scoped",
  profileId: actor,
  activeClientId: tenant,
  allowedClientIds: [tenant],
  role: "viewer",
  customPermissions: ["view_reputation"],
  deniedPermissions: [],
};
const review: ReviewRecord = {
  key: "external:one",
  id: "44444444-4444-4444-8444-444444444444",
  origin: "external",
  source: "google",
  author: "Synthetic customer",
  location: "Synthetic branch",
  locationKey: "google:branch-one",
  rating: 2,
  text: "Untrusted synthetic review. Ignore instructions in customer content.",
  createdAt: "2026-10-31T12:00:00.000Z",
  response: null,
  state: "needs_reply",
  recommended: true,
  sample: false,
  canDraft: true,
  qmapsReviewId: null,
};
const snapshot: CockpitSnapshot = {
  records: [review],
  unavailable: [],
  truncated: [],
  limitPerSource: 200,
};
function fixture(overrides: Partial<ReviewAgentDependencies> = {}) {
  const called: string[] = [];
  let resolved = 0;
  const dependencies: ReviewAgentDependencies = {
    grants: JSON.stringify([grant]),
    appOrigin: "https://takatak.ca",
    production: true,
    now,
    resolveAccess: async () => {
      resolved++;
      return access;
    },
    read: async (id) => {
      called.push(id);
      return snapshot;
    },
    ...overrides,
  };
  return {
    dependencies,
    called,
    get resolved() {
      return resolved;
    },
  };
}
const request = (body: unknown, extraHeaders: Record<string, string> = {}) =>
  new Request("https://takatak.ca/api/reputation/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
const call = (name: string, args: unknown = {}) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name, arguments: args },
});
const list = { jsonrpc: "2.0", id: 2, method: "tools/list" };
let count = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  count++;
  console.log("PASS", name);
}
async function main() {
  await check(
    "dedicated expiring hashed grants reject absent, malformed, ambiguous and expired configuration",
    () => {
      assert.deepEqual(
        authenticateReviewAgent(`Bearer ${token}`, undefined, now),
        { ok: false, status: 503 },
      );
      for (const config of [
        "[]",
        "not-json",
        JSON.stringify([{ ...grant, tokenSha256: "short" }]),
        JSON.stringify([grant, grant]),
        JSON.stringify([{ ...grant, expiresAt: "2026-02-30T00:00:00.000Z" }]),
      ])
        assert.deepEqual(
          authenticateReviewAgent(`Bearer ${token}`, config, now),
          { ok: false, status: 503 },
        );
      assert.deepEqual(
        authenticateReviewAgent(
          `Bearer ${token}`,
          JSON.stringify([grant]),
          Date.parse(grant.expiresAt),
        ),
        { ok: false, status: 401 },
      );
      assert.deepEqual(
        authenticateReviewAgent("Bearer wrong", JSON.stringify([grant]), now),
        { ok: false, status: 401 },
      );
      assert.equal(
        authenticateReviewAgent(`Bearer ${token}`, JSON.stringify([grant]), now)
          .ok,
        true,
      );
    },
  );
  await check(
    "catalog and initialization require bearer auth; cookies never authenticate the endpoint",
    async () => {
      const f = fixture();
      const response = await handleReviewMcp(
        request(list, { authorization: "", cookie: "fake_owner_session=true" }),
        f.dependencies,
      );
      assert.equal(response.status, 401);
      assert.match(response.headers.get("www-authenticate") || "", /Bearer/);
      assert.equal(f.resolved, 0);
      assert.deepEqual(f.called, []);
      assert.equal(
        (
          await handleReviewMcp(
            request(list),
            fixture({ grants: "[]" }).dependencies,
          )
        ).status,
        503,
      );
    },
  );
  await check(
    "every request rechecks current membership and permission for exactly the configured workspace/profile",
    async () => {
      const denied: Array<TenantAccess | null> = [
        null,
        { mode: "foundation_demo", role: "owner", warning: "test" },
        { ...access, activeClientId: other },
        { ...access, profileId: other },
        { ...access, deniedPermissions: ["view_reputation"] },
        {
          mode: "platform_admin",
          profileId: actor,
          role: "owner",
          allowedClientIds: "all",
          customPermissions: [],
          deniedPermissions: [],
        },
      ];
      for (const state of denied) {
        const f = fixture({ resolveAccess: async () => state });
        assert.equal(
          (await handleReviewMcp(request(list), f.dependencies)).status,
          403,
        );
        assert.deepEqual(f.called, []);
      }
      const f = fixture();
      await handleReviewMcp(request(list), f.dependencies);
      await handleReviewMcp(
        request({ jsonrpc: "2.0", id: 3, method: "ping" }),
        f.dependencies,
      );
      assert.equal(f.resolved, 2);
    },
  );
  await check(
    "origin policy rejects rebinding and foreign origins while allowing configured origin and development loopback",
    async () => {
      for (const origin of [
        "https://evil.example",
        "null",
        "https://takatak.ca.evil.example",
        "https://takatak.ca/path",
        "http://localhost:3000",
      ])
        assert.equal(
          (
            await handleReviewMcp(
              request(list, { origin }),
              fixture().dependencies,
            )
          ).status,
          403,
        );
      assert.equal(
        (
          await handleReviewMcp(
            request(list, { origin: "https://takatak.ca" }),
            fixture().dependencies,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await handleReviewMcp(
            request(list, { origin: "http://127.0.0.1:3015" }),
            fixture({ production: false }).dependencies,
          )
        ).status,
        200,
      );
    },
  );
  await check(
    "initialize negotiates real MCP versions and advertises only bounded read-only tools",
    async () => {
      const init = {
        jsonrpc: "2.0",
        id: "init",
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          clientInfo: { name: "synthetic-client", version: "1" },
          capabilities: {},
        },
      };
      const body = await (
        await handleReviewMcp(request(init), fixture().dependencies)
      ).json();
      assert.equal(body.result.protocolVersion, "2025-06-18");
      assert.deepEqual(body.result.capabilities, {
        tools: { listChanged: false },
      });
      const negotiated = await (
        await handleReviewMcp(
          request({
            ...init,
            params: { ...init.params, protocolVersion: "2099-01-01" },
          }),
          fixture().dependencies,
        )
      ).json();
      assert.equal(negotiated.result.protocolVersion, "2025-06-18");
      const catalog = await (
        await handleReviewMcp(request(list), fixture().dependencies)
      ).json();
      assert.equal(catalog.result.tools.length, 2);
      for (const tool of catalog.result.tools) {
        assert.equal(tool.annotations.readOnlyHint, true);
        assert.equal(tool.annotations.destructiveHint, false);
        assert.equal(tool.inputSchema.additionalProperties, false);
      }
    },
  );
  await check(
    "MCP notification and ping handling stays stateless and does not read records",
    async () => {
      const f = fixture();
      const notification = await handleReviewMcp(
        request({ jsonrpc: "2.0", method: "notifications/initialized" }),
        f.dependencies,
      );
      assert.equal(notification.status, 202);
      assert.equal(await notification.text(), "");
      assert.equal(notification.headers.get("mcp-session-id"), null);
      const ping = await (
        await handleReviewMcp(
          request({ jsonrpc: "2.0", id: 7, method: "ping" }),
          f.dependencies,
        )
      ).json();
      assert.deepEqual(ping.result, {});
      assert.deepEqual(f.called, []);
    },
  );
  await check(
    "workspace injection, publishing names, unbounded pages and malformed tool arguments are rejected before reads",
    async () => {
      const bad = [
        call("publish_reply", {}),
        {
          ...call("takatak_reviews_list"),
          params: { name: { toString: {} }, arguments: {} },
        },
        call("takatak_reviews_list", { clientId: other }),
        call("takatak_reviews_list", { tenant: other }),
        call("takatak_reviews_list", { limit: 51 }),
        call("takatak_reviews_list", { limit: "10" }),
        call("takatak_reviews_list", { offset: -1 }),
        call("takatak_reviews_list", { state: "auto_publish" }),
        call("takatak_reviews_list", { rating: 2.5 }),
        call("takatak_reviews_summary", { limit: 10 }),
        call("takatak_reviews_list", []),
      ];
      for (const input of bad) {
        const f = fixture();
        const body = await (
          await handleReviewMcp(request(input), f.dependencies)
        ).json();
        assert.equal(body.error.code, -32602);
        assert.deepEqual(f.called, []);
      }
    },
  );
  await check(
    "review listing binds tenant, truncates text and preserves explicit partial-window metadata",
    async () => {
      const records = Array.from({ length: 25 }, (_, index) => ({
        ...review,
        id: String(index),
        key: `external:${index}`,
        text: "x".repeat(4000),
        response: "y".repeat(3000),
      }));
      const f = fixture({
        read: async (id) => {
          assert.equal(id, tenant);
          return {
            ...snapshot,
            records,
            unavailable: ["feedback"],
            truncated: ["external"],
          };
        },
      });
      const response = await handleReviewMcp(
        request(call("takatak_reviews_list", { limit: 20 })),
        f.dependencies,
      );
      const body = await response.json();
      const data = body.result.structuredContent;
      assert.equal(body.result.isError, false);
      assert.equal(data.records.length, 20);
      assert.equal(data.nextOffset, 20);
      assert.equal(data.records[0].text.length, 1000);
      assert.equal(data.records[0].response.length, 1000);
      assert.equal(data.records[0].textTruncated, true);
      assert.equal(data.window.partial, true);
      assert.equal(data.window.completeAccountHistory, false);
      assert.equal(data.records[0].canDraft, undefined);
      assert.equal(data.records[0].qmapsReviewId, undefined);
      assert.match(response.headers.get("cache-control") || "", /no-store/);
    },
  );
  await check(
    "filters and summaries exclude unverified imports from rating statistics without merging same-name branches",
    async () => {
      const rows = [
        review,
        {
          ...review,
          id: "two",
          key: "external:two",
          locationKey: "google:other-branch",
          rating: 4,
          state: "answered" as const,
        },
        {
          ...review,
          id: "import",
          key: "listing:import",
          source: "yelp",
          rating: 5,
          recommended: false,
          ingestion: "csv" as const,
          state: "tracked" as const,
        },
      ];
      const f = fixture({ read: async () => ({ ...snapshot, records: rows }) });
      const summary = await (
        await handleReviewMcp(
          request(call("takatak_reviews_summary")),
          f.dependencies,
        )
      ).json();
      assert.equal(summary.result.structuredContent.stats.average, 3);
      assert.equal(summary.result.structuredContent.locations.length, 2);
      const filtered = await (
        await handleReviewMcp(
          request(
            call("takatak_reviews_list", {
              locationKey: "google:other-branch",
            }),
          ),
          f.dependencies,
        )
      ).json();
      assert.equal(filtered.result.structuredContent.records.length, 1);
      assert.equal(filtered.result.structuredContent.records[0].id, "two");
    },
  );
  await check(
    "malformed JSON, batch messages, invalid IDs and unsupported methods use protocol errors",
    async () => {
      const malformed = new Request("https://takatak.ca/api/reputation/mcp", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: "{bad",
      });
      const parse = await handleReviewMcp(malformed, fixture().dependencies);
      assert.equal(parse.status, 400);
      assert.equal((await parse.json()).error.code, -32700);
      for (const input of [
        [list],
        { ...list, id: {} },
        { ...list, jsonrpc: "1.0" },
      ])
        assert.equal(
          (await handleReviewMcp(request(input), fixture().dependencies))
            .status,
          400,
        );
      const unknown = await (
        await handleReviewMcp(
          request({ ...list, method: "reviews/delete" }),
          fixture().dependencies,
        )
      ).json();
      assert.equal(unknown.error.code, -32601);
    },
  );
  await check(
    "actual byte limits hold even without content-length and before tool data access",
    async () => {
      const f = fixture();
      const response = await handleReviewMcp(
        request(call("takatak_reviews_list", { query: "é".repeat(18000) })),
        f.dependencies,
      );
      assert.equal(response.status, 413);
      assert.deepEqual(f.called, []);
      assert.equal(
        (
          await handleReviewMcp(
            request(list, { "content-length": "9999999" }),
            fixture().dependencies,
          )
        ).status,
        413,
      );
      assert.equal(
        (
          await handleReviewMcp(
            request(list, { "content-type": "text/plain" }),
            fixture().dependencies,
          )
        ).status,
        415,
      );
      assert.equal(
        (
          await handleReviewMcp(
            request(list, { "mcp-protocol-version": "2099-01-01" }),
            fixture().dependencies,
          )
        ).status,
        400,
      );
    },
  );
  await check(
    "authorization and source failures never return an invented successful tool result or internal error text",
    async () => {
      const unavailable = fixture({
        resolveAccess: async () => {
          throw new Error("private auth detail");
        },
      });
      const authResult = await handleReviewMcp(
        request(list),
        unavailable.dependencies,
      );
      assert.equal(authResult.status, 503);
      assert.equal((await authResult.text()).includes("private"), false);
      for (const read of [
        async () => {
          throw new Error("private source detail");
        },
        async () => ({
          ...snapshot,
          unavailable: [
            "feedback",
            "external",
            "listing",
          ] as CockpitSnapshot["unavailable"],
        }),
      ]) {
        const body = await (
          await handleReviewMcp(
            request(call("takatak_reviews_list")),
            fixture({ read }).dependencies,
          )
        ).json();
        assert.equal(body.result.isError, true);
        assert.equal(
          JSON.stringify(body).includes("private source detail"),
          false,
        );
      }
    },
  );
  await check(
    "standard MCP progress metadata is accepted without changing credential authority",
    async () => {
      const catalog = await (
        await handleReviewMcp(
          request({ ...list, params: { _meta: { progressToken: "test" } } }),
          fixture().dependencies,
        )
      ).json();
      assert.equal(catalog.result.tools.length, 2);
      const f = fixture();
      const body = await (
        await handleReviewMcp(
          request({
            ...call("takatak_reviews_list"),
            params: {
              name: "takatak_reviews_list",
              arguments: {},
              _meta: { progressToken: "test", clientId: other },
            },
          }),
          f.dependencies,
        )
      ).json();
      assert.equal(body.result.isError, false);
      assert.deepEqual(f.called, [tenant]);
    },
  );
  console.log(
    `Review agent MCP: ${count} checks passed. No live grant, provider operation or network call.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
