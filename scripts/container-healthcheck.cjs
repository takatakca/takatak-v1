"use strict";

const fs = require("node:fs");

const role = (process.env.TAKATAK_PROCESS || "web").trim();
const heartbeatPath = "/tmp/takatak-worker-heartbeat";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (role === "web") {
  const port = process.env.PORT || "3000";
  fetch(`http://127.0.0.1:${port}/api/health/ready`)
    .then((response) => {
      process.exit(response.ok ? 0 : 1);
    })
    .catch(() => {
      process.exit(1);
    });
} else if (role === "general" || role === "social" || role === "webhooks") {
  let stat;
  try {
    stat = fs.statSync(heartbeatPath);
  } catch {
    fail("worker heartbeat missing");
  }
  if (Date.now() - stat.mtimeMs > 30_000) {
    fail("worker heartbeat stale");
  }
  process.exit(0);
} else {
  fail("TAKATAK_PROCESS is not web, general, social, or webhooks");
}
