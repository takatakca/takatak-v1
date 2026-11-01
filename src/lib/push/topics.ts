// Push deal alerts: consent wording, safe to import from browser code.

export type Lang = "fr" | "en";

/** Bump when the wording changes: stored with every consent as proof. */
export const PUSH_CONSENT_VERSION = "2026-10-31.1";

/** Shown in our own prompt, before the browser asks for permission. */
export function pushConsentText(lang: Lang): string {
  return lang === "fr"
    ? "J'accepte de recevoir sur cet appareil une notification de Groupe TAKATAK quand une vraie promotion commence. Je peux arrêter en tout temps ici ou dans les réglages de mon navigateur. Ce consentement ne vaut ni pour les courriels ni pour les textos."
    : "I agree to receive a Groupe TAKATAK notification on this device when a real promotion starts. I can stop at any time here or in my browser settings. This consent does not cover email or text messages.";
}
