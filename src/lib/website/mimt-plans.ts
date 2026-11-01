// MIMT business phone plans shown on takatak.ca. Snapshot of the MIMT source
// of truth: takatakca/mimtcaapp `packages/shared/src/plans.ts` (2026-11-01).
// Prices in CAD before taxes (GST/QST and the Québec 9-1-1 municipal tax are
// added on the bill). Business plans are per line. Change them there first,
// then copy here; never type a price that is not in that file.

type Bi = { fr: string; en: string };

export interface MimtPlan {
  code: "lock" | "business" | "business_pro";
  name: Bi;
  monthlyCents: number;
  perLine: boolean;
  pitch: Bi;
  minutes: { out: number; in: number };
  messages: number;
  features: Bi[];
  featured?: boolean;
}

const F = {
  number: { fr: "Numéro local réel, gardé tant que le forfait est payé", en: "A real local number, kept while the plan is paid" },
  vmEmail: { fr: "Boîte vocale par courriel, message d'accueil personnalisé", en: "Voicemail to email, custom greeting" },
  transcription: { fr: "Transcription de la boîte vocale", en: "Voicemail transcription" },
  forwarding: { fr: "Renvoi d'appels et MMS", en: "Call forwarding and MMS" },
  attendant: { fr: "Standard automatique et groupes d'appel", en: "Auto attendant and ring groups" },
  admin: { fr: "Portail administrateur pour l'équipe", en: "Admin portal for the team" },
  ai: { fr: "Assistance IA : réponses aux textos, réceptionniste", en: "AI assist: text replies, receptionist" },
  video: { fr: "Réunions vidéo MIMT", en: "MIMT video meetings" },
  calendar: { fr: "Appels et résumés dans Google Agenda", en: "Calls and summaries in Google Calendar" },
  recording: { fr: "Enregistrement des appels (750 min)", en: "Call recording (750 min)" },
} as const;

export const MIMT_PLANS: readonly MimtPlan[] = [
  {
    code: "lock",
    name: { fr: "Essentiel", en: "Essential" },
    monthlyCents: 1299,
    perLine: false,
    pitch: { fr: "Un deuxième numéro pour le travail, sur votre cellulaire.", en: "A second number for work, on your cell phone." },
    minutes: { out: 60, in: 120 },
    messages: 150,
    features: [F.number, F.vmEmail],
  },
  {
    code: "business",
    name: { fr: "Affaires", en: "Business" },
    monthlyCents: 3499,
    perLine: true,
    pitch: { fr: "Le système téléphonique de votre entreprise, sans matériel.", en: "Your company phone system, no hardware." },
    minutes: { out: 300, in: 400 },
    messages: 300,
    features: [F.number, F.attendant, F.admin, F.ai, F.transcription, F.video, F.calendar],
    featured: true,
  },
  {
    code: "business_pro",
    name: { fr: "Affaires Pro", en: "Business Pro" },
    monthlyCents: 4499,
    perLine: true,
    pitch: { fr: "Tout Affaires, plus l'enregistrement et 4 appels en même temps.", en: "All of Business, plus recording and 4 calls at once." },
    minutes: { out: 350, in: 450 },
    messages: 400,
    features: [F.number, F.attendant, F.admin, F.ai, F.recording, F.video, F.calendar],
  },
];

/** Annual plans: 12 months for the price of 11 (MIMT YEARLY_MONTHS_PAID). */
export const MIMT_YEARLY_MONTHS_PAID = 11;

export const MIMT_LINKS = {
  plans: { fr: "https://mimt.ca/forfaits/", en: "https://mimt.ca/en/plans/" },
  business: { fr: "https://mimt.ca/affaires/", en: "https://mimt.ca/en/business/" },
} as const;
