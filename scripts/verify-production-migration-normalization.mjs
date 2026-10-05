import assert from "node:assert/strict";

import {
  canonicalSql,
  normalizeHistoricalVehicleAuthority,
} from "./production-migration-normalization.mjs";

const currentAuthority = `
v_is_admin := COALESCE(
  rentauto.has_role('admin'::rentauto.app_role),
  false
)
  OR COALESCE(auth.role() = 'service_role', false);
`;

const historicalAuthority = `
v_is_admin := rentauto.has_role('admin'::rentauto.app_role);
`;

assert.equal(
  canonicalSql(normalizeHistoricalVehicleAuthority(currentAuthority)),
  canonicalSql(historicalAuthority),
);

assert.equal(
  canonicalSql('-- comment\nSELECT "Example";'),
  "selectexample;",
);

console.log("verify-production-migration-normalization: all checks passed");
