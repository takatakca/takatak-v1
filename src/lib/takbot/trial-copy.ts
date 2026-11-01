// Words for the live TAK bot trial on the homepage. French first.

type T = { fr: string; en: string };

export const trialCopy = {
  tabs: { try: { fr: "Essayer maintenant", en: "Try it now" }, app: { fr: "Voir l'app", en: "See the app" } },
  title: { fr: "TAK bot, en direct", en: "TAK bot, live" },
  free: (n: number): T => ({ fr: `${n} crédits offerts`, en: `${n} free credits` }),
  steps: [
    { fr: "Connectez-vous avec Google", en: "Sign in with Google" },
    { fr: "Votre fiche client est créée", en: "Your client file is created" },
    { fr: "Vos crédits d'essai arrivent", en: "Your trial credits arrive" },
  ] as T[],
  google: { fr: "Continuer avec Google", en: "Continue with Google" },
  email: { fr: "Ou avec mon courriel", en: "Or with my email" },
  consent: {
    fr: "En continuant, vous créez votre compte TAKATAK (une fiche client à votre nom et à votre courriel). Vos réponses y sont gardées. Aucun courriel promotionnel sans votre accord.",
    en: "By continuing, you create your TAKATAK account (a client file with your name and email). Your answers are kept there. No promotional email without your consent.",
  },
  terms: { fr: "Conditions", en: "Terms" },
  privacy: { fr: "Confidentialité", en: "Privacy" },
  soon: {
    fr: "L'essai gratuit ouvre très bientôt. En attendant, regardez l'app ou ouvrez TAK bot.",
    en: "The free trial opens very soon. Meanwhile, watch the app or open TAK bot.",
  },
  openTakbot: { fr: "Ouvrir TAK bot", en: "Open TAK bot" },
  welcome: (name: string | null, n: number): T => ({
    fr: `${name ? `Bienvenue, ${name}. ` : "Bienvenue. "}${n} crédits sont dans votre compte.`,
    en: `${name ? `Welcome, ${name}. ` : "Welcome. "}${n} credits are in your account.`,
  }),
  hello: (name: string | null): T => ({ fr: name ? `Bonjour, ${name}.` : "Bonjour.", en: name ? `Hi, ${name}.` : "Hi." }),
  balance: { fr: "crédits", en: "credits" },
  economy: (engine: string | null): T => ({
    fr: `Essai · moteur économique${engine ? ` (${engine})` : ""}`,
    en: `Trial · economy engine${engine ? ` (${engine})` : ""}`,
  }),
  premium: { fr: "Premium · les meilleurs moteurs", en: "Premium · the best engines" },
  placeholder: {
    chat: { fr: "Posez votre question à TAK bot…", en: "Ask TAK bot anything…" },
    write: { fr: "Ex. : une publication Facebook pour mon resto, ton chaleureux", en: "E.g. a Facebook post for my restaurant, warm tone" },
    research: { fr: "Ex. : 5 idées de mots-clés pour un plombier à Laval", en: "E.g. 5 keyword ideas for a plumber in Laval" },
  },
  samples: [
    { mode: "write", fr: "Écris 3 publications Instagram pour un café de quartier", en: "Write 3 Instagram posts for a neighbourhood café" },
    { mode: "chat", fr: "Comment répondre à un avis Google à 2 étoiles ?", en: "How do I answer a 2-star Google review?" },
    { mode: "research", fr: "Quels mots-clés pour un salon de coiffure à Montréal ?", en: "Which keywords for a hair salon in Montréal?" },
  ] as Array<{ mode: "chat" | "write" | "research" } & T>,
  samplesLabel: { fr: "Exemples", en: "Examples" },
  send: { fr: "Envoyer", en: "Send" },
  costs: (n: number): T => ({ fr: n === 1 ? "1 crédit" : `${n} crédits`, en: n === 1 ? "1 credit" : `${n} credits` }),
  thinking: { fr: "TAK bot réfléchit…", en: "TAK bot is thinking…" },
  saved: { fr: "Gardée dans votre fiche", en: "Saved to your file" },
  seeSaved: { fr: "Voir mes réponses", en: "See my answers" },
  out: {
    fr: "Vos crédits d'essai sont utilisés. Un forfait débloque les moteurs premium (Claude, GPT, Perplexity…).",
    en: "Your trial credits are used. A pack unlocks the premium engines (Claude, GPT, Perplexity…).",
  },
  buy: { fr: "Voir les forfaits", en: "See the packs" },
  claiming: { fr: "Préparation de votre compte…", en: "Setting up your account…" },
  workspace: { fr: "Choisissez votre espace dans le tableau de bord, puis revenez ici.", en: "Choose your workspace in the dashboard, then come back here." },
  dashboard: { fr: "Tableau de bord", en: "Dashboard" },
  errors: {
    insufficient_credits: { fr: "Pas assez de crédits pour cette demande.", en: "Not enough credits for this request." },
    sign_in_required: { fr: "Votre session a pris fin. Reconnectez-vous.", en: "Your session ended. Please sign in again." },
    trial_unavailable: { fr: "L'essai n'est pas offert en ce moment.", en: "The trial is not available right now." },
    rate_limited: { fr: "Trop d'essais depuis ce réseau aujourd'hui. Réessayez demain.", en: "Too many trials from this network today. Try again tomorrow." },
    no_engine_connected: { fr: "Le moteur d'essai n'est pas encore branché. Ça arrive très bientôt.", en: "The trial engine is not connected yet. Coming very soon." },
    timeout: { fr: "Le moteur a pris trop de temps. Vos crédits sont revenus.", en: "The engine took too long. Your credits were returned." },
    generic: { fr: "Ça n'a pas fonctionné. Vos crédits sont revenus.", en: "That did not work. Your credits were returned." },
  } as Record<string, T>,
  google_off: { fr: "La connexion Google n'est pas encore activée. Utilisez votre courriel.", en: "Google sign-in is not on yet. Use your email." },
} as const;
