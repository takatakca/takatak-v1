/**
 * Existing-provider handoff. There is no cross-provider SSO here.
 * Keep credentials on the real provider site; never clone its password form.
 *
 * Only audited, exact HTTPS origins may be linked from TAKATAK.
 * DNS authority cannot be inferred from website hosting or registrar alone.
 */
export const MOCHAHOST_CLIENT_AREA_URL = "https://clients.mochahost.com/" as const;

export type DomainProviderHandoff = Readonly<{
  label: string;
  url: typeof MOCHAHOST_CLIENT_AREA_URL;
  supportsAutomaticLogin: false;
  controlsVerified: false;
}>;

export function domainProviderHandoff(registrar: string | null | undefined): DomainProviderHandoff | null {
  if (!registrar) return null;
  const normalized = registrar.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized !== "mochahost") return null;
  return {
    label: "MochaHost Client Area",
    url: MOCHAHOST_CLIENT_AREA_URL,
    supportsAutomaticLogin: false,
    controlsVerified: false,
  };
}
