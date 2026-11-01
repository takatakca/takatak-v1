// Newsletter topics, safe to import from browser code (no Node modules).

export type Lang = "fr" | "en";

export const NEWSLETTER_TOPICS = ["offers", "tips", "news"] as const;
export type NewsletterTopic = (typeof NEWSLETTER_TOPICS)[number];

export const TOPIC_LABELS: Record<NewsletterTopic, Record<Lang, string>> = {
  offers: { fr: "Offres et promotions en cours", en: "Current offers and promotions" },
  tips: { fr: "Conseils et leçons de la TAKATAK Academy", en: "Tips and TAKATAK Academy lessons" },
  news: { fr: "Nouveaux services", en: "New services" },
};
