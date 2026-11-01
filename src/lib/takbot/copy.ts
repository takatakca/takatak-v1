// TAK bot wording, English and Canadian French side by side.

import type { Bi } from "@/lib/website/service-pages";
import type { TakbotMode } from "./catalog";

export const takbotModeCopy: Record<TakbotMode, { name: Bi; hint: Bi; placeholder: Bi }> = {
  chat: {
    name: { en: "Chat", fr: "Clavarder" },
    hint: { en: "Ask anything", fr: "Posez n’importe quelle question" },
    placeholder: { en: "Ask TAK bot anything about your business…", fr: "Demandez n’importe quoi à TAK bot sur votre entreprise…" },
  },
  write: {
    name: { en: "Write", fr: "Rédiger" },
    hint: { en: "Ads, posts, emails", fr: "Pubs, publications, courriels" },
    placeholder: { en: "Write 5 Facebook ad headlines for my bakery in Laval…", fr: "Écris 5 titres de pub Facebook pour ma boulangerie à Laval…" },
  },
  research: {
    name: { en: "Research", fr: "Rechercher" },
    hint: { en: "Market and competitors", fr: "Marché et concurrents" },
    placeholder: { en: "Who are the top 5 pizza places in Montréal and why?", fr: "Quelles sont les 5 meilleures pizzerias de Montréal et pourquoi ?" },
  },
  image: {
    name: { en: "Image", fr: "Image" },
    hint: { en: "Product and ad visuals", fr: "Visuels produits et pubs" },
    placeholder: { en: "A poster for our summer menu, bright, Montréal terrace…", fr: "Une affiche pour notre menu d’été, lumineuse, terrasse montréalaise…" },
  },
  voice: {
    name: { en: "Voice", fr: "Voix" },
    hint: { en: "Voice-overs, phone voices", fr: "Narrations, voix téléphoniques" },
    placeholder: { en: "A 20-second voice-over for our new store opening…", fr: "Une narration de 20 secondes pour l’ouverture de notre boutique…" },
  },
  video: {
    name: { en: "Video", fr: "Vidéo" },
    hint: { en: "Short ads and reels", fr: "Courtes pubs et reels" },
    placeholder: { en: "A 15-second reel showing our coffee being made…", fr: "Un reel de 15 secondes qui montre la préparation de notre café…" },
  },
};

export const takbotCopy = {
  meta: {
    title: "TAK bot — one AI, every engine",
    description: "TAK bot is TAKATAK's master AI bot. Ask once; it relays to Claude, ChatGPT, Gemini, Mistral and more. Pay with credits.",
  },
  hero: {
    eyebrow: { en: "TAKATAK AI · Master bot", fr: "TAKATAK IA · Bot maître" },
    title: { en: "Ask once. TAK bot picks the best AI.", fr: "Demandez une fois. TAK bot choisit la meilleure IA." },
    subtitle: {
      en: "One prompt bar for every engine: Claude, ChatGPT, Gemini, Mistral, Grok and more. Leave it on Auto, or choose the engine yourself.",
      fr: "Une seule barre pour tous les moteurs : Claude, ChatGPT, Gemini, Mistral, Grok et plus. Laissez-le en Auto, ou choisissez le moteur vous-même.",
    },
  },
  composer: {
    engine: { en: "Engine", fr: "Moteur" },
    auto: { en: "Auto (TAK bot decides)", fr: "Auto (TAK bot décide)" },
    search: { en: "Search engines…", fr: "Chercher un moteur…" },
    send: { en: "Run", fr: "Lancer" },
    cost: { en: "{n} credits per request", fr: "{n} crédits par demande" },
    costOne: { en: "1 credit per request", fr: "1 crédit par demande" },
    balance: { en: "Balance: {n} credits", fr: "Solde : {n} crédits" },
    signIn: { en: "Create a free account to run TAK bot", fr: "Créez un compte gratuit pour lancer TAK bot" },
    signInCta: { en: "Create my account", fr: "Créer mon compte" },
    login: { en: "Sign in", fr: "Se connecter" },
    workspace: { en: "Choose a workspace in your dashboard first.", fr: "Choisissez d’abord un espace de travail dans votre tableau de bord." },
    studio: {
      en: "{mode} runs in AI Studio, inside your dashboard, where you can review each result before using it.",
      fr: "{mode} se fait dans AI Studio, dans votre tableau de bord, où vous validez chaque résultat avant de l’utiliser.",
    },
    openStudio: { en: "Open AI Studio", fr: "Ouvrir AI Studio" },
    thinking: { en: "TAK bot is relaying to {engine}…", fr: "TAK bot relaie à {engine}…" },
    answeredBy: { en: "Answered by {engine}", fr: "Réponse de {engine}" },
    viaAuto: { en: " · picked by TAK bot", fr: " · choisi par TAK bot" },
    spent: { en: "{n} credits used · {b} left", fr: "{n} crédits utilisés · reste {b}" },
    connected: { en: "Connected", fr: "Connecté" },
    notConnected: { en: "Not connected yet", fr: "Pas encore connecté" },
  },
  errors: {
    sign_in_required: { en: "Sign in to run TAK bot.", fr: "Connectez-vous pour lancer TAK bot." },
    workspace_required: { en: "Choose a workspace in your dashboard first.", fr: "Choisissez d’abord un espace de travail dans votre tableau de bord." },
    forbidden: { en: "Your role cannot create content in this workspace.", fr: "Votre rôle ne permet pas de créer du contenu dans cet espace." },
    insufficient_credits: { en: "Not enough credits. Add a pack below.", fr: "Crédits insuffisants. Ajoutez un forfait plus bas." },
    no_engine_connected: { en: "This engine is not connected yet. Try Auto or another engine.", fr: "Ce moteur n’est pas encore connecté. Essayez Auto ou un autre moteur." },
    engine_mode_mismatch: { en: "This engine does not do that. Pick another one.", fr: "Ce moteur ne fait pas ça. Choisissez-en un autre." },
    rate_limited: { en: "The engine is busy. Your credits were returned; try again in a minute.", fr: "Le moteur est occupé. Vos crédits sont revenus ; réessayez dans une minute." },
    generic: { en: "That did not work. Your credits were returned.", fr: "Ça n’a pas fonctionné. Vos crédits sont revenus." },
  },
  how: {
    title: { en: "How the master bot works", fr: "Comment fonctionne le bot maître" },
    steps: [
      { t: { en: "You ask", fr: "Vous demandez" }, d: { en: "One prompt, in French or English, in Chat, Write or Research.", fr: "Une demande, en français ou en anglais, en Clavarder, Rédiger ou Rechercher." } },
      { t: { en: "TAK bot routes", fr: "TAK bot aiguille" }, d: { en: "It picks the best connected engine for the job, or uses the one you chose.", fr: "Il choisit le meilleur moteur connecté pour la tâche, ou celui que vous avez choisi." } },
      { t: { en: "Credits, not subscriptions", fr: "Des crédits, pas d’abonnements" }, d: { en: "The cost is shown before you run. If the engine fails, the credits come back.", fr: "Le coût est affiché avant de lancer. Si le moteur échoue, les crédits reviennent." } },
      { t: { en: "Your keys stay ours", fr: "Les clés restent chez nous" }, d: { en: "Engine keys live encrypted on TAKATAK servers. Your browser never sees them.", fr: "Les clés des moteurs restent chiffrées sur les serveurs TAKATAK. Votre navigateur ne les voit jamais." } },
    ],
  },
  engines: {
    title: { en: "Engine status board", fr: "Tableau des moteurs" },
    subtitle: {
      en: "Live from our servers: which engines TAK bot can reach right now.",
      fr: "En direct de nos serveurs : les moteurs que TAK bot peut joindre en ce moment.",
    },
    inline: { en: "Answers here", fr: "Répond ici" },
    studio: { en: "In AI Studio", fr: "Dans AI Studio" },
  },
  credits: {
    title: { en: "Credit packs", fr: "Forfaits de crédits" },
    subtitle: {
      en: "Buy once, use across TAK bot and every TAKATAK AI tool. Credits do not expire while your account is open.",
      fr: "Achetez une fois, utilisez partout : TAK bot et tous les outils d’IA TAKATAK. Les crédits n’expirent pas tant que votre compte est ouvert.",
    },
    buy: { en: "Buy {name}", fr: "Acheter {name}" },
    soon: { en: "Online checkout opens soon. Ask us to add credits to your account.", fr: "Le paiement en ligne ouvre bientôt. Demandez-nous d’ajouter des crédits à votre compte." },
    ask: { en: "Ask for credits", fr: "Demander des crédits" },
    costs: { en: "What one credit buys", fr: "Ce qu’un crédit permet" },
  },
} as const;
