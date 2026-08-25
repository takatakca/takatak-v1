/**
 * Compatibility re-exports — prefer social-canonical-identity for new code.
 */

export {
  pickSelectedFacebookAccount,
  pickSelectedFacebookAccountStrict,
  pickConnectedPlatformAccount,
} from "@/lib/social/connections/social-canonical-identity";

export function isPersistedSelectedFacebookPage(account: {
  platform: string;
  status: string;
  accessStatus?: string | null;
}): boolean {
  return (
    account.platform === "facebook" &&
    account.status === "connected" &&
    (account.accessStatus === "selected" ||
      account.accessStatus == null)
  );
}
