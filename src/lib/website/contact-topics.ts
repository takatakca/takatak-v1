/**
 * Subjects of the public message box (/contact, the support panel, /freelancers).
 * Each one reaches the TAKATAK leads inbox as a project request with the
 * category `contact-<topic>`, so the team can sort messages by subject.
 */
export const CONTACT_TOPICS = {
  question: { en: "A question before buying", fr: "Une question avant d’acheter" },
  support: { en: "Help with my account or a service", fr: "De l’aide pour mon compte ou un service" },
  billing: { en: "Billing or a payment", fr: "Facturation ou paiement" },
  partner: { en: "Work with TAKATAK (freelancer or partner)", fr: "Travailler avec TAKATAK (pigiste ou partenaire)" },
  other: { en: "Something else", fr: "Autre chose" },
} as const satisfies Record<string, { en: string; fr: string }>;

export type ContactTopic = keyof typeof CONTACT_TOPICS;

/** The lead category recorded for a subject. */
export function contactCategory(topic: ContactTopic): string {
  return `contact-${topic}`;
}

/**
 * Lead title for a message. It quotes the start of the message so the intake's duplicate check
 * (same contact, same title, 15 minutes) only collapses a repeated send of the same message, never a
 * second, different message. The closing quote keeps a short message from matching a longer one.
 */
export function contactTitle(topic: ContactTopic, message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  const excerpt = oneLine.length > 90 ? `${oneLine.slice(0, 90).trimEnd()}…` : oneLine;
  return `Contact · ${CONTACT_TOPICS[topic].en} · « ${excerpt} »`;
}
