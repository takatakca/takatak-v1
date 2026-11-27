// Guards the checkout: a blank NEXT_PUBLIC_UPMIND_* value (what the Dockerfile
// produces for an unset build argument) must never reach the page.
import assert from "node:assert/strict";

const NAMES = [
  "ORDER_CONFIG_URL", "WIDGET_SCRIPT_URL", "DAC_SCRIPT_URL", "CURRENCY", "DOMAIN_SEARCH_MODE",
] as const;

async function main() {
  for (const name of NAMES) process.env[`NEXT_PUBLIC_UPMIND_${name}`] = "";
  const config = await import("../src/lib/website/upmind-config");
  assert.match(config.UPMIND_ORDER_CONFIG_URL, /^https:\/\/.+\/order\/product$/);
  assert.match(config.UPMIND_WIDGET_SCRIPT_URL, /^https:\/\/.+\.js$/);
  assert.match(config.UPMIND_DAC_SCRIPT_URL, /^https:\/\/.+\.js$/);
  assert.equal(config.UPMIND_CURRENCY, "CAD");
  assert.equal(config.UPMIND_DOMAIN_SEARCH_MODE, "register");
  console.log("qa:upmind-config passed (blank build settings fall back to defaults)");
}

void main().catch((error) => { console.error(error); process.exit(1); });
