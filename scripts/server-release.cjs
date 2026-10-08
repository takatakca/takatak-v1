"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** Capture the attested marker once at process startup, so stale Passenger cannot report a new disk release. */
function readReleaseSha(appDirectory) {
  try {
    const marker = fs.readFileSync(path.join(appDirectory, "BUILD_ID"), "utf8").trim();
    const match = marker.match(/^(?:ci|staging)-([a-f0-9]{40})$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

module.exports = { readReleaseSha };
