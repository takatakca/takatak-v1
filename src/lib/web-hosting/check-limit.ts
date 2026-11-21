import "server-only";

// Brake on the website checks (security, DNS, redirects): each one makes the
// server contact a public site, so one person cannot use them to hammer a
// host. 30 checks per person per 10 minutes, across the three tools.
import { createFixedWindowLimiter } from "@/lib/security/fixed-window-limiter";

export const WEBSITE_CHECKS_PER_WINDOW = 30;
export const WEBSITE_CHECK_WINDOW_MS = 10 * 60 * 1000;

const limiter = createFixedWindowLimiter({ windowMs: WEBSITE_CHECK_WINDOW_MS, max: WEBSITE_CHECKS_PER_WINDOW });

export const TOO_MANY_CHECKS =
  "Trop de vérifications d’affilée ; réessayez dans quelques minutes · Too many checks in a row; try again in a few minutes.";

/** True when this signed-in person may run one more website check now. */
export function allowWebsiteCheck(profileId: string): boolean {
  return limiter.allow(`website-check:${profileId}`);
}
