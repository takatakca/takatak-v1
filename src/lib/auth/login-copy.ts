export type LoginLanguage = "en" | "fr";

const EMAIL_REQUIRED = "Email is required.";
const EMAIL_TOO_LONG = "Email address is too long.";
const EMAIL_INVALID = "Enter a valid email address.";

export const LOGIN_COPY = {
  en: {
    metaTitle: "Sign in",
    title: "Welcome back",
    intro:
      "Sign in with your verified mobile number, or use an email address you have already confirmed in Account settings.",
    sms: "SMS",
    email: "Email",
    phoneLabel: "TAKATAK mobile number",
    countryLabel: "Country calling code",
    countryCA: "Canada / US (+1)",
    countryNG: "Nigeria (+234)",
    countryIntl: "Other country (enter +code)",
    sendSms: "Send TAKATAK SMS code",
    sendEmail: "Send email code",
    sending: "Sending code…",
    emailLabel: "Email",
    newPrompt: "New to TAKATAK?",
    createAccount: "Create an account",
    createIdentity: "Create your identity",
    invalidPhone:
      "Enter a valid number for your country. For Nigerian local numbers, select Nigeria (+234).",
    smsUncertain:
      "The SMS request could not be completed. It may already have been sent; do not repeatedly request another code.",
    network: "A network error occurred. Check your connection and try again.",
    authMissingTitle: "Auth not configured yet",
    authMissingBody:
      "Supabase environment variables are missing. Add them locally, then restart the development server.",
    emailErrors: {
      [EMAIL_REQUIRED]: EMAIL_REQUIRED,
      [EMAIL_TOO_LONG]: EMAIL_TOO_LONG,
      [EMAIL_INVALID]: EMAIL_INVALID,
    },
  },
  fr: {
    metaTitle: "Connexion",
    title: "Bon retour",
    intro:
      "Connectez-vous avec votre numéro de mobile vérifié, ou avec une adresse courriel déjà confirmée dans les paramètres du compte.",
    sms: "SMS",
    email: "Courriel",
    phoneLabel: "Numéro mobile TAKATAK",
    countryLabel: "Indicatif du pays",
    countryCA: "Canada / États-Unis (+1)",
    countryNG: "Nigeria (+234)",
    countryIntl: "Autre pays (indiquez l'indicatif +)",
    sendSms: "Envoyer le code SMS TAKATAK",
    sendEmail: "Envoyer le code par courriel",
    sending: "Envoi du code…",
    emailLabel: "Courriel",
    newPrompt: "Nouveau sur TAKATAK ?",
    createAccount: "Créer un compte",
    createIdentity: "Créer votre identité",
    invalidPhone:
      "Entrez un numéro valide pour votre pays. Pour un numéro local du Nigeria, choisissez Nigeria (+234).",
    smsUncertain:
      "La demande SMS n'a pas pu aboutir. Elle a peut-être déjà été envoyée ; ne demandez pas un autre code à répétition.",
    network: "Une erreur réseau est survenue. Vérifiez la connexion et réessayez.",
    authMissingTitle: "Authentification pas encore configurée",
    authMissingBody:
      "Les variables d'environnement Supabase manquent. Ajoutez-les localement, puis redémarrez le serveur de développement.",
    emailErrors: {
      [EMAIL_REQUIRED]: "Le courriel est obligatoire.",
      [EMAIL_TOO_LONG]: "L'adresse courriel est trop longue.",
      [EMAIL_INVALID]: "Entrez une adresse courriel valide.",
    },
  },
} as const;

export function loginCopy(lang: LoginLanguage) {
  return LOGIN_COPY[lang];
}

export function localizeLoginEmailError(message: string, lang: LoginLanguage): string {
  const mapped = LOGIN_COPY[lang].emailErrors[message as keyof typeof LOGIN_COPY.en.emailErrors];
  return mapped ?? message;
}

export function loginPath(path: string, lang: LoginLanguage): string {
  if (lang !== "fr") return path;
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("lang", "fr");
  return `${base}?${params.toString()}`;
}
