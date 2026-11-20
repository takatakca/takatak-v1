// TAKATAK Food Hub unit tests (pure logic + in-memory storage; no network, no database).
// Run: npm run qa:food-hub

process.env.FOODHUB_FORCE_MEMORY = "true";
process.env.LIVE_CONNECTORS_GLOBAL_ENABLED = "false";

async function runFoodHubTests() {
  await import("./food-hub-tests/foodhub.test");
  await import("./food-hub-tests/atlas-parity.test");
  await import("./food-hub-tests/rc9.test");
  const { run } = await import("./food-hub-tests/shim");
  await run();
}

runFoodHubTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
