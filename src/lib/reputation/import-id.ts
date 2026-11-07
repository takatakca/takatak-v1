import { createHash } from "node:crypto";
import { REVIEW_IMPORT_HOSTS } from "./import-model";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Custom UUIDv8 namespace: retries match; different tenants/listings never mix. */
export function stableReviewImportId(
  clientId: string,
  listingId: string,
  source: string,
  externalId: string,
): string {
  if (
    !UUID.test(clientId) ||
    !UUID.test(listingId) ||
    !Object.hasOwn(REVIEW_IMPORT_HOSTS, source) ||
    !(
      typeof externalId === "string" &&
      externalId.length <= 256 &&
      !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(externalId)
    ) ||
    !externalId.trim()
  )
    throw new Error("invalid_import_identity");
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        "takatak.review-import.v1",
        clientId.toLowerCase(),
        listingId.toLowerCase(),
        source,
        externalId.trim(),
      ]),
    )
    .digest("hex")
    .slice(0, 32);
  const variant = ((parseInt(digest[16], 16) & 3) | 8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20)}`;
}
