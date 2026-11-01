// MIMT business phone plans shown on takatak.ca. Snapshot of the MIMT source
// of truth: takatakca/mimtcaapp `packages/shared/src/plans.ts` (2026-11-01).
// Prices in CAD before taxes (GST/QST and the Québec 9-1-1 municipal tax are
// added on the bill). Business plans are per line. Change them there first,
// then copy here; never type a price that is not in that file.

type Bi = { fr: string; en: string };

export type MimtPlanCode = "free" | "lock" | "premium" | "business" | "business_pro";

export interface MimtPlan {
  code: MimtPlanCode;
  name: Bi;
  monthlyCents: number;
  perLine: boolean;
  pitch: Bi;
  /** Plain lines from the plan's caps, in the plan file's own numbers. */
  caps: Bi[];
  features: Bi[];
  featured?: boolean;
}

const F = {
  noNumber: { fr: "Sans numéro : appels d'app à app (120 min par mois)", en: "No number: app-to-app calls (120 min a month)" },
  addLater: { fr: "Ajoutez un vrai numéro quand vous voulez", en: "Add a real number whenever you want" },
  browser: { fr: "Sur votre cellulaire et dans votre navigateur (app.mimt.ca), même compte", en: "On your cell phone and in your browser (app.mimt.ca), same account" },
  number: { fr: "Numéro local réel, gardé tant que le forfait est payé", en: "A real local number, kept while the plan is paid" },
  vmEmail: { fr: "Boîte vocale par courriel, message d'accueil personnalisé", en: "Voicemail to email, custom greeting" },
  transcription: { fr: "Transcription de la boîte vocale", en: "Voicemail transcription" },
  forwarding: { fr: "Renvoi d'appels et MMS", en: "Call forwarding and MMS" },
  attendant: { fr: "Standard automatique et groupes d'appel", en: "Auto attendant and ring groups" },
  admin: { fr: "Portail administrateur pour l'équipe", en: "Admin portal for the team" },
  ai: { fr: "IA : réponses aux textos, réceptionniste", en: "AI: text replies, receptionist" },
  video: { fr: "Réunions vidéo MIMT", en: "MIMT video meetings" },
  calendar: { fr: "Appels et résumés dans Google Agenda", en: "Calls and summaries in Google Calendar" },
  recording: { fr: "Enregistrement des appels (750 min)", en: "Call recording (750 min)" },
} as const;

const caps = (out: number, inbound: number, texts: number): Bi[] => [
  { fr: `${out} min sortantes · ${inbound} min entrantes`, en: `${out} min outbound · ${inbound} min inbound` },
  { fr: `${texts} textos par mois`, en: `${texts} texts per month` },
];

export const MIMT_PLAN_LIST: Record<MimtPlanCode, MimtPlan> = {
  free: {
    code: "free",
    name: { fr: "Gratuit", en: "Free" },
    monthlyCents: 0,
    perLine: false,
    pitch: { fr: "Ouvrez votre compte MIMT à 0 $ et commencez tout de suite.", en: "Open your MIMT account at $0 and start right away." },
    caps: [],
    features: [F.noNumber, F.browser, F.addLater],
  },
  lock: {
    code: "lock",
    name: { fr: "Essentiel", en: "Essential" },
    monthlyCents: 1299,
    perLine: false,
    pitch: { fr: "Un deuxième numéro pour le travail, sur votre cellulaire.", en: "A second number for work, on your cell phone." },
    caps: caps(60, 120, 150),
    features: [F.number, F.vmEmail],
  },
  premium: {
    code: "premium",
    name: { fr: "Premium", en: "Premium" },
    monthlyCents: 2999,
    perLine: false,
    pitch: { fr: "Sans pub, avec transcription, MMS, IA et vidéo.", en: "Ad-free, with transcription, MMS, AI and video." },
    caps: caps(200, 300, 400),
    features: [F.number, F.transcription, F.forwarding, F.ai, F.video],
  },
  business: {
    code: "business",
    name: { fr: "Affaires", en: "Business" },
    monthlyCents: 3499,
    perLine: true,
    pitch: { fr: "Le système téléphonique de votre entreprise, sans matériel.", en: "Your company phone system, no hardware." },
    caps: caps(300, 400, 300),
    features: [F.number, F.attendant, F.admin, F.ai, F.transcription, F.video, F.calendar],
    featured: true,
  },
  business_pro: {
    code: "business_pro",
    name: { fr: "Affaires Pro", en: "Business Pro" },
    monthlyCents: 4499,
    perLine: true,
    pitch: { fr: "Tout Affaires, plus l'enregistrement et 4 appels en même temps.", en: "All of Business, plus recording and 4 calls at once." },
    caps: caps(350, 450, 400),
    features: [F.number, F.attendant, F.admin, F.ai, F.recording, F.video, F.calendar],
  },
};

/** The three offers to start with: $0, a work number, the company system. */
export const MIMT_START_PLANS: readonly MimtPlan[] = [MIMT_PLAN_LIST.free, MIMT_PLAN_LIST.lock, MIMT_PLAN_LIST.business];
/** Shown on one line under the three offers. */
export const MIMT_MORE_PLANS: readonly MimtPlan[] = [MIMT_PLAN_LIST.premium, MIMT_PLAN_LIST.business_pro];

/** Annual plans: 12 months for the price of 11 (MIMT YEARLY_MONTHS_PAID). */
export const MIMT_YEARLY_MONTHS_PAID = 11;

export const MIMT_LINKS = {
  plans: { fr: "https://mimt.ca/forfaits/", en: "https://mimt.ca/en/plans/" },
  business: { fr: "https://mimt.ca/affaires/", en: "https://mimt.ca/en/business/" },
  /** Free account: signing in to the MIMT app creates it. */
  signup: { fr: "https://app.mimt.ca/connexion", en: "https://app.mimt.ca/connexion" },
} as const;
