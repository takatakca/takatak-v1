/** Cross-component refresh for the social top-bar brand selector. */
export const SOCIAL_BRAND_SELECTOR_REFRESH_EVENT =
  "takatak:social-brand-selector-refresh";

export function requestSocialBrandSelectorRefresh(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new Event(SOCIAL_BRAND_SELECTOR_REFRESH_EVENT),
  );
}
