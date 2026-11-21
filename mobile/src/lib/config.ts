// The native app talks to the same TAKATAK platform and the same accounts as takatak.ca. Nothing here is secret.
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { siteOrigin?: string };

export const SITE_ORIGIN = extra.siteOrigin ?? 'https://takatak.ca';
export const LINKS = {
  dashboard: `${SITE_ORIGIN}/dashboard`,
  privacy: `${SITE_ORIGIN}/privacy-policy`,
  terms: `${SITE_ORIGIN}/terms-of-service`,
  deleteData: `${SITE_ORIGIN}/data-deletion`,
  support: `${SITE_ORIGIN}/dashboard/support`,
  billing: `${SITE_ORIGIN}/dashboard/billing`,
  site: SITE_ORIGIN,
};
