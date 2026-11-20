import assert from "node:assert/strict";
import { parseOrganizerPreviewRequest } from "../src/lib/ai-file-organizer/preview-request";

const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
assert.deepEqual(parseOrganizerPreviewRequest({ outputId:a, destinationProjectId:b }),
  { outputId:a, destinationProjectId:b });
assert.equal(parseOrganizerPreviewRequest({ outputId:a, destinationProjectId:a }), null);
assert.equal(parseOrganizerPreviewRequest({ outputId:a, destinationProjectId:"../../demo" }), null);
assert.equal(parseOrganizerPreviewRequest({ outputId:"", destinationProjectId:b }), null);
assert.equal(parseOrganizerPreviewRequest({ outputId:a, destinationProjectId:b, clientId:a }), null);
assert.equal(parseOrganizerPreviewRequest({ outputId:a, destinationProjectId:b, confidence:1 }), null);
assert.equal(parseOrganizerPreviewRequest({ outputId:a, destinationProjectId:b, policy: { mode:"auto" } }), null);
assert.equal(parseOrganizerPreviewRequest({ outputId:a, destinationProjectId:b, sourceContent:"secret" }), null);
assert.equal(parseOrganizerPreviewRequest({ destinationProjectId:b }), null);
assert.equal(parseOrganizerPreviewRequest(["x","y"]), null);
assert.equal(parseOrganizerPreviewRequest(null), null);
console.log("AI organizer preview request isolation: 11 assertions passed");
