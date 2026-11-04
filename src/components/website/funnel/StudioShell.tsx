"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  AudioLines,
  Blocks,
  Bot,
  Clapperboard,
  FileUp,
  ImageIcon,
  Mail,
  MessageSquare,
  PenLine,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";

import { TAKBOT_ACTIONS, TAKBOT_MODES, creditsFor } from "@/lib/takbot/catalog";
import { takbotModeCopy } from "@/lib/takbot/copy";
import { openLiveChat } from "@/lib/website/chat-provider";
import { WALL_AI, WALL_GROWTH, WALL_HOUSE, WALL_TOTAL } from "@/lib/website/connector-wall";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { Mark } from "./ConnectorWall";
import { RobotMascot } from "./RobotMascot";
import { setTakbotMode, type TryMode } from "./TakbotTryPanel";

type T = { fr: string; en: string };
type Pane = "chat" | "write" | "research" | "image" | "voice" | "video" | "files" | "connectors" | "plugins" | "skills" | "agents";

const CREATE: { key: Pane; icon: typeof Search; label: T }[] = [
  { key: "chat", icon: MessageSquare, label: { fr: "Clavarder", en: "Chat" } },
  { key: "write", icon: PenLine, label: { fr: "Rédiger", en: "Write" } },
  { key: "research", icon: Search, label: { fr: "Labo de recherche", en: "Research lab" } },
  { key: "image", icon: ImageIcon, label: { fr: "Image", en: "Image" } },
  { key: "voice", icon: AudioLines, label: { fr: "Voix", en: "Voice" } },
  { key: "video", icon: Clapperboard, label: { fr: "Vidéo", en: "Video" } },
];

const SPACE: { key: Pane; icon: typeof Search; label: T; tag?: T }[] = [
  { key: "files", icon: FileUp, label: { fr: "Fichiers", en: "Files" }, tag: { fr: "bientôt", en: "soon" } },
  { key: "connectors", icon: Plug, label: { fr: "Connecteurs", en: "Connectors" } },
  { key: "plugins", icon: Blocks, label: { fr: "Plugins", en: "Plugins" }, tag: { fr: "bientôt", en: "soon" } },
  { key: "skills", icon: Wand2, label: { fr: "Compétences", en: "Skills" } },
  { key: "agents", icon: Bot, label: { fr: "Agents · AIOS", en: "Agents · AIOS" }, tag: { fr: "nouveau", en: "new" } },
];

/** French names of the real AI actions (src/lib/growth/ai-engine.ts). */
const SKILL_FR: Record<string, string> = {
  social_caption: "Légende et mots-clics",
  multi_platform_post: "Une publication adaptée à chaque réseau",
  review_reply: "Réponse à un avis",
  chat_reply: "Réponse clavardage ou WhatsApp",
  ad_copy_set: "Textes d’annonces (5 titres, 3 descriptions)",
  seo_audit_summary: "Plan d’action SEO",
  blog_article: "Article de blogue SEO (~1 000 mots)",
  image: "Image générée",
  voice_over: "Voix hors champ (par minute)",
  short_video: "Vidéo courte (jusqu’à 15 s)",
  monthly_report_summary: "Résumé du rapport mensuel",
};

const MEDIA: Record<"image" | "voice" | "video", { prompts: T[]; options: T[]; hint: T }> = {
  image: {
    prompts: [
      { fr: "Photo d’un bol de poutine, lumière chaude, fond de bois", en: "A bowl of poutine, warm light, wooden table" },
      { fr: "Affiche du spécial du midi, couleurs de ma marque", en: "Lunch special poster in my brand colours" },
    ],
    options: [{ fr: "1:1", en: "1:1" }, { fr: "9:16", en: "9:16" }, { fr: "16:9", en: "16:9" }, { fr: "Photo", en: "Photo" }, { fr: "Illustration", en: "Illustration" }],
    hint: { fr: "Pour vos publications, menus et annonces.", en: "For your posts, menus and ads." },
  },
  voice: {
    prompts: [
      { fr: "Message d’accueil du répondeur, voix chaleureuse", en: "Voicemail greeting, warm voice" },
      { fr: "Voix hors champ de 30 s pour ma vidéo", en: "30 s voice-over for my video" },
    ],
    options: [{ fr: "Français (Québec)", en: "French (Québec)" }, { fr: "Anglais", en: "English" }, { fr: "Calme", en: "Calm" }, { fr: "Énergique", en: "Upbeat" }],
    hint: { fr: "Pour la ligne MIMT, vos vidéos et vos annonces.", en: "For your MIMT line, videos and ads." },
  },
  video: {
    prompts: [
      { fr: "Reel de 10 s : le plat du jour qui sort de la cuisine", en: "10 s reel: today's dish leaving the kitchen" },
      { fr: "Vidéo courte pour annoncer nos heures des fêtes", en: "Short video announcing our holiday hours" },
    ],
    options: [{ fr: "9:16 · Reels", en: "9:16 · Reels" }, { fr: "16:9 · YouTube", en: "16:9 · YouTube" }, { fr: "5 s", en: "5 s" }, { fr: "15 s", en: "15 s" }],
    hint: { fr: "Pour Instagram, TikTok, YouTube et votre site.", en: "For Instagram, TikTok, YouTube and your site." },
  },
};

const PLUGINS: { name: string; d: T }[] = [
  { name: "Food Hub", d: { fr: "Lire les commandes du jour, signaler un retard.", en: "Read today's orders, flag a delay." } },
  { name: "QMAPS", d: { fr: "Mettre à jour heures et photos de la fiche.", en: "Update the listing's hours and photos." } },
  { name: "SEO TAKATAK", d: { fr: "Lancer un audit, résumer le plan d’action.", en: "Run an audit, sum up the action plan." } },
  { name: "MIMT", d: { fr: "Transcrire un message vocal, rappeler un client.", en: "Transcribe a voicemail, call a customer back." } },
  { name: "Facturations", d: { fr: "Préparer une facture avec TPS et TVQ.", en: "Prepare an invoice with GST and QST." } },
  { name: "FLEXS", d: { fr: "Trier les nouvelles demandes de service.", en: "Sort new service requests." } },
];

const AIOS: { icon: typeof Mail; t: T }[] = [
  { icon: Mail, t: { fr: "Lit vos courriels et prépare les réponses", en: "Reads your email and drafts the replies" } },
  { icon: Star, t: { fr: "Répond aux avis Google et Facebook", en: "Answers Google and Facebook reviews" } },
  { icon: MessageSquare, t: { fr: "Répond aux clients : heures, menu, allergies, commandes", en: "Answers customers: hours, menu, allergies, orders" } },
  { icon: Sparkles, t: { fr: "Suit vos commandes Food Hub et vous résume la journée", en: "Follows your Food Hub orders and sums up your day" } },
];

function Tag({ children, tone = "soon" }: { children: ReactNode; tone?: "soon" | "new" | "ok" }) {
  const cls = tone === "new" ? "bg-[#29C3FF]/15 text-[#7FD8FF]" : tone === "ok" ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300";
  return <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${cls}`}>{children}</span>;
}

function MediaPane({ kind }: { kind: "image" | "voice" | "video" }) {
  const { tx, lang } = useLanguage();
  const reduced = useReducedMotion();
  const def = TAKBOT_MODES.find((m) => m.key === kind)!;
  const m = MEDIA[kind];
  const [pick, setPick] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1400);
    return () => window.clearInterval(id);
  }, [reduced]);
  return (
    <div className="p-4 sm:p-5">
      <p className="text-[12px] text-white/55">{tx(m.hint)}</p>
      <div className="mt-3 rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10">
        <p className="min-h-[44px] text-[14.5px] text-white/90">{tx(m.prompts[pick])}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {m.options.map((o, i) => (
            <span key={o.en} className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${i === 0 ? "bg-white text-[#060D1F]" : "bg-white/[0.06] text-white/70"}`}>
              {tx(o)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {m.prompts.map((p, i) => (
          <button key={p.en} type="button" onClick={() => setPick(i)} className={`rounded-full px-3 py-1 text-[12px] ${pick === i ? "bg-[#1F8BFF] text-white" : "bg-white/[0.04] text-white/60 hover:text-white"}`}>
            {lang === "fr" ? "Exemple" : "Example"} {i + 1}
          </button>
        ))}
      </div>
      {/* Generation canvas: tiles shimmer, then appear one after another (illustration). */}
      <div className={`mt-4 grid gap-2 ${kind === "voice" ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4"}`} aria-hidden>
        {(kind === "voice" ? [0, 1] : [0, 1, 2, 3]).map((i) => {
          const done = reduced || (tick + i) % 5 > 1;
          if (kind === "voice") {
            return (
              <div key={i} className="flex h-14 items-center gap-1 rounded-xl bg-white/[0.04] px-3 ring-1 ring-white/10">
                {Array.from({ length: 36 }, (_, j) => (
                  <span key={j} className="w-1 rounded-full bg-[#29C3FF] transition-all duration-500" style={{ height: done ? `${20 + ((j * 37 + i * 11) % 70)}%` : "12%", opacity: 0.4 + ((j % 5) * 0.12) }} />
                ))}
              </div>
            );
          }
          return (
            <div
              key={i}
              className={`relative overflow-hidden rounded-xl ring-1 ring-white/10 transition-all duration-700 ${kind === "video" ? "aspect-[9/16]" : "aspect-square"} ${done ? "opacity-100" : "opacity-60"}`}
              style={{
                background: done
                  ? ["linear-gradient(135deg,#F59E0B,#B45309)", "linear-gradient(135deg,#1F8BFF,#0B1B3D)", "linear-gradient(135deg,#EC4899,#7C3AED)", "linear-gradient(135deg,#10B981,#065F46)"][i]
                  : "rgb(255 255 255 / 0.05)",
              }}
            >
              {!done && <span className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent_30%,rgb(255_255_255/0.12)_50%,transparent_70%)]" />}
              {kind === "video" && done && <Clapperboard size={14} className="absolute bottom-2 left-2 text-white/80" />}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12.5px] text-white/50">
          {lang === "fr" ? "Aperçu à titre illustratif" : "Illustrative preview"} · {creditsFor(def)} {lang === "fr" ? "crédits par demande" : "credits per request"}
        </span>
        <Link to={`/takbot?mode=${kind}`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#060D1F]">
          {lang === "fr" ? `Ouvrir ${takbotModeCopy[kind].name.fr} dans le studio` : `Open ${takbotModeCopy[kind].name.en} in the studio`} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function SpacePane({ pane }: { pane: Exclude<Pane, TryMode | "image" | "voice" | "video"> }) {
  const { tx, lang } = useLanguage();
  if (pane === "files") {
    return (
      <div className="p-4 sm:p-5">
        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] px-4 py-10 text-center">
          <FileUp size={28} className="text-[#29C3FF]" aria-hidden />
          <p className="mt-3 text-[15px] font-semibold text-white">{tx({ fr: "Glissez un menu, une photo, un logo ou un PDF", en: "Drop a menu, a photo, a logo or a PDF" })}</p>
          <p className="mt-1.5 max-w-sm text-[13px] leading-5 text-white/55">
            {tx({
              fr: "TAK-TAK s’en servira comme contexte pour écrire, chercher et créer. Les fichiers restent dans votre espace.",
              en: "TAK-TAK will use them as context to write, research and create. Files stay in your workspace.",
            })}
          </p>
          <span className="mt-4"><Tag>{tx({ fr: "Bientôt", en: "Soon" })}</Tag></span>
        </div>
      </div>
    );
  }
  if (pane === "connectors") {
    const items = [...WALL_AI.slice(0, 6), ...WALL_GROWTH.filter((i) => i.icon).slice(0, 9), ...WALL_HOUSE.slice(0, 5)];
    return (
      <div className="p-4 sm:p-5">
        <p className="text-[13px] text-white/60">
          {tx({ fr: `${WALL_TOTAL} services branchés au même compte : moteurs d’IA, réseaux, outils et nos propres applications.`, en: `${WALL_TOTAL} services plugged into one account: AI engines, networks, tools and our own apps.` })}
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((it, i) => (
            <li key={`${it.group}-${it.key}`} className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-1.5 pr-2 ring-1 ring-white/10">
              <Mark item={it} index={i} />
              <span className="truncate text-[12.5px] font-semibold text-white/85">{it.name}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-white/50">
          <ShieldCheck size={13} className="text-emerald-300" aria-hidden />
          {tx({ fr: "Chaque connexion se fait avec votre autorisation, et se retire en un clic.", en: "Each connection is made with your permission, and removed in one click." })}
        </p>
      </div>
    );
  }
  if (pane === "plugins") {
    return (
      <div className="p-4 sm:p-5">
        <p className="text-[13px] text-white/60">{tx({ fr: "TAK-TAK travaillera directement dans vos applications TAKATAK, toujours avec votre accord.", en: "TAK-TAK will work right inside your TAKATAK apps, always with your approval." })}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {PLUGINS.map((p) => (
            <li key={p.name} className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[linear-gradient(135deg,#1565D8,#29C3FF)] text-white">
                <Blocks size={15} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[13.5px] font-semibold text-white">{p.name} <Tag>{tx({ fr: "Bientôt", en: "Soon" })}</Tag></span>
                <span className="mt-0.5 block text-[12.5px] leading-5 text-white/55">{tx(p.d)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (pane === "skills") {
    return (
      <div className="p-4 sm:p-5">
        <p className="text-[13px] text-white/60">{tx({ fr: "Des compétences prêtes, chacune avec son coût fixe en crédits, affiché avant de lancer.", en: "Ready-made skills, each with a fixed credit cost, shown before you run it." })}</p>
        <ul className="mt-3 grid gap-1.5">
          {TAKBOT_ACTIONS.map((a) => (
            <li key={a.key} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/10">
              <span className="flex min-w-0 items-center gap-2 text-[13px] text-white/85">
                <Wand2 size={13} className="shrink-0 text-[#29C3FF]" aria-hidden />
                <span className="truncate">{lang === "fr" ? SKILL_FR[a.key] ?? a.label : a.label}</span>
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-white/50">
                {a.credits} {lang === "fr" ? (a.credits > 1 ? "crédits" : "crédit") : a.credits > 1 ? "credits" : "credit"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  // agents: AIOS
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:p-5">
      <div className="hidden sm:block" aria-hidden>
        <RobotMascot size={96} title="AIOS" />
      </div>
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[17px] font-bold text-white">
          AIOS <Tag tone="new">{tx({ fr: "En préparation", en: "In preparation" })}</Tag>
        </p>
        <p className="mt-1 text-[14px] leading-6 text-white/70">
          {tx({
            fr: "Un agent IA attitré à chaque restaurant. Il connaît votre menu, vos heures et vos commandes, et s’occupe des messages pendant que vous cuisinez.",
            en: "One AI agent assigned to each restaurant. It knows your menu, hours and orders, and handles the messages while you cook.",
          })}
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {AIOS.map((a) => (
            <li key={a.t.en} className="flex items-start gap-2.5 rounded-xl bg-white/[0.04] p-2.5 text-[13px] leading-5 text-white/80 ring-1 ring-white/10">
              <a.icon size={15} className="mt-0.5 shrink-0 text-[#29C3FF]" aria-hidden />
              {tx(a.t)}
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-white/55">
          <ShieldCheck size={13} className="text-emerald-300" aria-hidden />
          {tx({ fr: "Vous approuvez avant chaque envoi, et il dit toujours qu’il est une IA.", en: "You approve before anything is sent, and it always says it is an AI." })}
        </p>
        <button
          type="button"
          onClick={() => openLiveChat({ page: "/", intent: "aios_waitlist", lang })}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#060D1F]"
        >
          {tx({ fr: "Réserver AIOS pour mon restaurant", en: "Reserve AIOS for my restaurant" })} <ArrowRight size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * TAK-TAK as a creative AI studio: a side menu (create · your space) around
 * the live bot. Chat, Write and Research switch the live bot; Image, Voice and
 * Video show their studio canvas; Files, Connectors, Plugins, Skills and
 * Agents (AIOS) show what lives in your workspace, each with its real state.
 */
export function StudioShell({ children }: { children: ReactNode }) {
  const { tx } = useLanguage();
  const [pane, setPane] = useState<Pane>("write");
  const live = pane === "chat" || pane === "write" || pane === "research";

  function choose(p: Pane) {
    setPane(p);
    if (p === "chat" || p === "write" || p === "research") setTakbotMode(p);
  }

  const item = (it: { key: Pane; icon: typeof Search; label: T; tag?: T }) => {
    const on = pane === it.key;
    return (
      <li key={it.key} className="shrink-0">
        <button
          type="button"
          aria-pressed={on}
          onClick={() => choose(it.key)}
          className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold transition-colors ${
            on ? "bg-white text-[#060D1F]" : "text-white/70 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          <it.icon size={15} className={`shrink-0 ${on ? "text-[#1565D8]" : "text-[#29C3FF]"}`} aria-hidden />
          <span className="min-w-0 truncate">{tx(it.label)}</span>
          {it.tag && (
            <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${it.key === "agents" ? "bg-[#29C3FF]" : "bg-amber-300"}`} title={tx(it.tag)}>
              <span className="sr-only">{tx(it.tag)}</span>
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="overflow-hidden rounded-[22px] bg-[#070D1A] shadow-[0_50px_120px_-40px_rgb(0_0_0/0.9)] ring-1 ring-white/10 md:grid md:grid-cols-[196px_minmax(0,1fr)]">
      <nav aria-label={tx({ fr: "Studio TAK-TAK", en: "TAK-TAK studio" })} className="border-b border-white/10 bg-white/[0.02] p-2.5 md:border-b-0 md:border-r">
        <p className="hidden items-center gap-2 px-2 pb-3 pt-1 text-[12px] font-bold uppercase tracking-[0.16em] text-white/45 md:flex">
          <Sparkles size={13} className="text-[#29C3FF]" aria-hidden /> Studio
        </p>
        {/* Phones: one sliding row; desktop: a side menu in two groups. */}
        <ul className="tk-no-scrollbar flex gap-1 overflow-x-auto md:grid md:gap-0.5">{CREATE.map(item)}</ul>
        <p className="hidden px-2 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35 md:block">{tx({ fr: "Votre espace", en: "Your space" })}</p>
        <ul className="tk-no-scrollbar mt-1 flex gap-1 overflow-x-auto md:mt-0 md:grid md:gap-0.5">{SPACE.map(item)}</ul>
      </nav>
      <div className="min-w-0">
        <div hidden={!live}>{children}</div>
        {!live && (
          <div className="tk-fade-in">
            <p className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-[14px] font-semibold text-white sm:px-5">
              {(() => {
                const it = [...CREATE, ...SPACE].find((x) => x.key === pane)!;
                return (
                  <>
                    <it.icon size={16} className="text-[#29C3FF]" aria-hidden /> {tx(it.label)}
                  </>
                );
              })()}
            </p>
            {pane === "image" || pane === "voice" || pane === "video" ? <MediaPane kind={pane} /> : <SpacePane pane={pane} />}
          </div>
        )}
      </div>
    </div>
  );
}
