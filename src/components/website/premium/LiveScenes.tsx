"use client";

// The animated screens shown in laptops across the site: the homepage hero,
// and the "see it live" demo on each service page. Every scene plays the same
// three beats (working, built, success toast), like "Bienvenue chez vous" →
// "Succès, vous êtes en ligne". They are illustrations: generic business
// labels, no invented prices or customers.

import { useEffect, useState, type ReactNode } from "react";
import {
  Bot,
  Check,
  Globe2,
  Lock,
  LockKeyhole,
  MapPin,
  Megaphone,
  PhoneIncoming,
  ReceiptText,
  Send,
  Server,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import { BRAND_ICONS } from "@/lib/website/brand-icons";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

type Lang = "fr" | "en";

export type Scene = "website" | "domain" | "hosting" | "ads" | "social" | "reviews" | "local" | "leads" | "ai" | "billing" | "phone";

/** Steps of a scene: 0 idle, 1 working, 2 built, 3 success. */
export type Step = 0 | 1 | 2 | 3;

function Toast({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <span
      className={`absolute inset-x-4 bottom-4 flex items-center gap-2.5 rounded-2xl bg-emerald-500 px-4 py-3 text-[14px] font-semibold text-white shadow-[0_18px_40px_-14px_rgb(16_185_129/0.9)] transition-all duration-500 sm:inset-x-6 sm:bottom-5 sm:text-[15px] ${
        show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/25">
        <Check size={14} strokeWidth={3} aria-hidden />
      </span>
      {children}
    </span>
  );
}

function Brand({ slug, size = 18 }: { slug: string; size?: number }) {
  const icon = BRAND_ICONS[slug];
  if (!icon) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill={icon.hex}>
      <path d={icon.path} />
    </svg>
  );
}

/** What the laptop screen shows for one scene. */
export function LiveScreen({ scene, step, business, lang }: { scene: Scene; step: Step; business: string; lang: Lang }) {
  const fr = lang === "fr";
  const built = step >= 2;
  if (scene === "website") {
    return (
      <div className="absolute inset-0 bg-white">
        {/* skeleton while building */}
        <div className={`absolute inset-0 grid place-items-center transition-opacity duration-500 ${built ? "opacity-0" : "opacity-100"}`}>
          <div className="grid w-[70%] gap-2">
            <span className="h-3 rounded bg-slate-100" />
            <span className="h-3 w-2/3 rounded bg-slate-100" />
            <span className={`mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100`}>
              <span className="block h-full rounded-full bg-[#1F8BFF] transition-all duration-1000" style={{ width: step >= 1 ? "100%" : "8%" }} />
            </span>
            <span className="text-center text-[12px] font-semibold text-slate-500">{fr ? "Construction de votre site…" : "Building your site…"}</span>
          </div>
        </div>
        {/* the site: poof */}
        <div className={`absolute inset-0 p-3 transition-all duration-700 sm:p-4 ${built ? "scale-100 opacity-100 blur-0" : "scale-90 opacity-0 blur-sm"}`} style={{ transitionTimingFunction: "cubic-bezier(0.3,1.5,0.4,1)" }}>
          <div className={built ? "tk-page-browse" : undefined}>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 sm:text-[12px]">
            <span>{business}</span>
            <span className="hidden gap-3 text-slate-400 sm:flex">
              <span>{fr ? "Menu" : "Menu"}</span>
              <span>{fr ? "Réserver" : "Book"}</span>
              <span>Contact</span>
            </span>
          </div>
          <div className="mt-2 h-[52%] rounded-xl bg-[linear-gradient(135deg,#0B1B3D,#1F8BFF_60%,#29C3FF)] p-3 sm:p-4">
            <p className="text-[16px] font-extrabold text-white sm:text-[22px]">{fr ? "Bienvenue chez vous" : "Welcome in"}</p>
            <span className="mt-2 block h-2 w-1/2 rounded bg-white/50" />
            <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[#0B1B3D] sm:text-[11px]">{fr ? "Réserver →" : "Book →"}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-10 rounded-lg bg-slate-100 sm:h-14" style={{ transition: "opacity 0.5s", transitionDelay: `${i * 120}ms`, opacity: built ? 1 : 0 }} />
            ))}
          </div>
          {/* More of the page, reached by the slow scroll */}
          <div className="mt-3 grid grid-cols-[1.2fr_1fr] gap-2">
            <span className="h-16 rounded-lg bg-[linear-gradient(135deg,#F59E0B33,#F59E0B11)] sm:h-20" />
            <div className="grid gap-1.5">
              <span className="h-2 rounded bg-slate-200" />
              <span className="h-2 w-4/5 rounded bg-slate-100" />
              <span className="h-2 w-3/5 rounded bg-slate-100" />
              <span className="mt-1 h-5 w-20 rounded-full bg-[#1F8BFF]/15" />
            </div>
          </div>
          </div>
        </div>
        <Toast show={step === 3}>{fr ? "Succès, vous êtes en ligne" : "Success, you are live"}</Toast>
      </div>
    );
  }
  if (scene === "domain") {
    const names = [
      { n: fr ? "votremarque.ca" : "yourbrand.ca", ok: true },
      { n: fr ? "votremarque.com" : "yourbrand.com", ok: true },
      { n: fr ? "votremarque.quebec" : "yourbrand.shop", ok: true },
    ];
    return (
      <div className="absolute inset-0 bg-white p-4 sm:p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-slate-900 sm:text-[15px]">
          <Globe2 size={16} className="text-[#1F8BFF]" aria-hidden /> {fr ? "Domaines suggérés" : "Suggested domains"}
        </p>
        <ul className="mt-3 grid gap-2">
          {names.map((d, i) => (
            <li
              key={d.n}
              className={`flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] transition-all duration-500 sm:text-[14px] ${step >= 1 ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"} ${i === 0 && step >= 2 ? "border-[#1F8BFF] bg-[#1F8BFF]/5" : ""}`}
              style={{ transitionDelay: `${i * 140}ms` }}
            >
              <span className="font-semibold text-slate-900">{d.n}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${i === 0 && step >= 2 ? "bg-[#1F8BFF] text-white" : "bg-slate-100 text-slate-600"}`}>
                {i === 0 && step >= 2 ? (fr ? "Choisi" : "Picked") : fr ? "Vérifier" : "Check"}
              </span>
            </li>
          ))}
        </ul>
        <div className={`mt-3 flex items-center gap-2 text-[12px] font-semibold text-slate-600 transition-opacity duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          <Lock size={13} className="text-emerald-600" aria-hidden /> {fr ? "SSL et hébergement inclus dans le forfait" : "SSL and hosting in the plan"}
        </div>
        <Toast show={step === 3}>{fr ? "Domaine connecté à votre site" : "Domain connected to your site"}</Toast>
      </div>
    );
  }
  if (scene === "social") {
    const nets = ["facebook", "instagram", "tiktok"];
    return (
      <div className="absolute inset-0 bg-[#0E1729] p-4 sm:p-5">
        <div className="flex gap-2">
          {nets.map((n, i) => (
            <span
              key={n}
              className={`relative grid h-10 w-10 place-items-center rounded-xl bg-white transition-all duration-500 ${step >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
              style={{ transitionDelay: `${i * 140}ms`, transitionTimingFunction: "cubic-bezier(0.3,1.6,0.4,1)" }}
            >
              <Brand slug={n} />
              {step >= 3 && (
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check size={10} strokeWidth={3.5} aria-hidden />
                </span>
              )}
            </span>
          ))}
        </div>
        <div className={`mt-3 flex gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 transition-all duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          <span className="h-16 w-16 shrink-0 rounded-xl bg-[linear-gradient(135deg,#F59E0B,#B45309)] sm:h-20 sm:w-20" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{business} · {fr ? "nouveau menu" : "new menu"}</p>
            <span className="mt-2 block h-1.5 rounded bg-white/15" />
            <span className="mt-1.5 block h-1.5 w-2/3 rounded bg-white/15" />
            <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#1F8BFF] px-3 py-1 text-[11px] font-semibold text-white">
              <Send size={11} aria-hidden /> {fr ? "Publier partout" : "Post everywhere"}
            </span>
          </div>
        </div>
        <Toast show={step === 3}>{fr ? "Publié sur vos 3 réseaux" : "Posted to your 3 networks"}</Toast>
      </div>
    );
  }
  if (scene === "reviews") {
    return (
      <div className="absolute inset-0 bg-white p-4 sm:p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-slate-900 sm:text-[15px]">
          <Brand slug="google" size={16} /> {fr ? "Nouvel avis Google" : "New Google review"}
        </p>
        <div className="mt-2 flex gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} size={20} className={`fill-current transition-colors duration-300 ${step >= 1 ? "text-[#E7A008]" : "text-slate-200"}`} style={{ transitionDelay: `${i * 120}ms` }} aria-hidden />
          ))}
        </div>
        <div className={`mt-3 rounded-2xl bg-[#EEF3FA] p-3 transition-all duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          <p className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#1565D8]">
            <Sparkles size={11} aria-hidden /> {fr ? "Réponse proposée par l'IA" : "Reply drafted by AI"}
          </p>
          <p className="mt-1 text-[12.5px] text-slate-800 sm:text-[13.5px]">{fr ? "Merci beaucoup, au plaisir de vous revoir bientôt !" : "Thank you so much, see you again soon!"}</p>
        </div>
        <Toast show={step === 3}>{fr ? "Réponse publiée" : "Reply posted"}</Toast>
      </div>
    );
  }
  if (scene === "local") {
    return (
      <div className="absolute inset-0 bg-[#E8EEF7]">
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
          <path d="M0 170 L400 110 M90 0 L160 250 M280 0 L240 250 M0 60 L400 210" stroke="#fff" strokeWidth="14" />
          <rect x="300" y="150" width="70" height="50" rx="8" fill="#CFE8D6" />
        </svg>
        <span className={`absolute left-[58%] top-[16%] transition-all duration-500 ${step >= 1 ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"}`}>
          <MapPin size={34} className="fill-[#1F8BFF] text-white drop-shadow-lg" aria-hidden />
        </span>
        <div className={`absolute inset-x-4 bottom-16 rounded-2xl bg-white p-3 shadow-lg transition-all duration-500 sm:bottom-20 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          <p className="text-[13px] font-bold text-slate-900">{business}</p>
          <p className="mt-0.5 text-[11.5px] text-slate-600">
            <span className="text-[#E7A008]">★★★★★</span> · {fr ? "Ouvert · Heures des fêtes à jour" : "Open · Holiday hours updated"}
          </p>
        </div>
        <Toast show={step === 3}>{fr ? "Fiche à jour partout" : "Listing updated everywhere"}</Toast>
      </div>
    );
  }
  if (scene === "leads") {
    return (
      <div className="absolute inset-0 bg-white p-4 sm:p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-slate-900 sm:text-[15px]">
          <Users size={16} className="text-[#1F8BFF]" aria-hidden /> {fr ? "Nouvelles demandes" : "New requests"}
        </p>
        <ul className="mt-3 grid gap-2">
          {[fr ? "Soumission · rénovation de cuisine" : "Quote · kitchen renovation", fr ? "Réservation · 6 personnes, samedi" : "Booking · 6 people, Saturday", fr ? "Question · livraison à Laval" : "Question · delivery to Laval"].map((r, i) => (
            <li
              key={r}
              className={`flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] text-slate-800 transition-all duration-500 sm:text-[13.5px] ${step >= 1 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
              style={{ transitionDelay: `${i * 160}ms` }}
            >
              {r}
              <span className="rounded-full bg-[#1F8BFF]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#1565D8]">{fr ? "Nouveau" : "New"}</span>
            </li>
          ))}
        </ul>
        <Toast show={step === 3}>{fr ? "Demandes ajoutées à votre CRM" : "Requests added to your CRM"}</Toast>
      </div>
    );
  }
  if (scene === "hosting") {
    const rows = [
      { k: fr ? "Certificat SSL" : "SSL certificate", v: fr ? "Actif" : "Active" },
      { k: fr ? "Sauvegarde quotidienne" : "Daily backup", v: fr ? "Faite à 3 h" : "Done at 3 a.m." },
      { k: fr ? "Mises à jour" : "Updates", v: fr ? "À jour" : "Up to date" },
    ];
    return (
      <div className="absolute inset-0 bg-[#0E1729] p-4 sm:p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-white sm:text-[15px]">
          <Server size={16} className="text-[#29C3FF]" aria-hidden /> {fr ? "Hébergement de votre site" : "Your site's hosting"}
        </p>
        <div className="mt-3 flex h-12 items-end gap-1" aria-hidden>
          {[40, 55, 35, 70, 50, 85, 60, 75, 45, 90, 65, 80].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t bg-[linear-gradient(180deg,#29C3FF,#1F8BFF)] transition-all duration-700"
              style={{ height: step >= 1 ? `${h}%` : "6%", transitionDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
        <ul className="mt-3 grid gap-1.5">
          {rows.map((r, i) => (
            <li
              key={r.k}
              className={`flex items-center justify-between rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/80 transition-all duration-500 sm:text-[13px] ${step >= 2 ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"}`}
              style={{ transitionDelay: `${i * 130}ms` }}
            >
              {r.k}
              <span className="flex items-center gap-1 font-semibold text-emerald-300">
                <Check size={12} strokeWidth={3} aria-hidden /> {r.v}
              </span>
            </li>
          ))}
        </ul>
        <Toast show={step === 3}>{fr ? "Site rapide, sécurisé et sauvegardé" : "Site fast, secure and backed up"}</Toast>
      </div>
    );
  }
  if (scene === "ads") {
    return (
      <div className="absolute inset-0 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[13px] font-bold text-slate-900 sm:text-[15px]">
            <Megaphone size={16} className="text-[#1F8BFF]" aria-hidden /> {fr ? "Campagne · " : "Campaign · "}{business}
          </p>
          <span className="flex gap-1.5">
            <Brand slug="googleads" size={16} />
            <Brand slug="meta" size={16} />
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { k: fr ? "Budget / jour" : "Daily budget", v: fr ? "Vous choisissez" : "You choose" },
            { k: fr ? "Zone" : "Area", v: fr ? "Votre quartier" : "Your area" },
            { k: fr ? "Objectif" : "Goal", v: fr ? "Appels" : "Calls" },
          ].map((c, i) => (
            <span
              key={c.k}
              className={`rounded-xl border border-slate-200 px-2.5 py-2 transition-all duration-500 ${step >= 1 ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <span className="block text-[10px] uppercase tracking-wide text-slate-500">{c.k}</span>
              <span className="block truncate text-[12px] font-semibold text-slate-900 sm:text-[13px]">{c.v}</span>
            </span>
          ))}
        </div>
        <svg viewBox="0 0 300 70" preserveAspectRatio="none" className="mt-3 h-14 w-full" aria-hidden>
          <path
            d="M0 62 C40 58 60 50 90 46 S150 30 180 28 S240 12 300 6"
            fill="none"
            stroke="#1F8BFF"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={step >= 2 ? 0 : 1}
            style={{ transition: "stroke-dashoffset 1.2s ease" }}
          />
        </svg>
        <Toast show={step === 3}>{fr ? "Campagne en ligne" : "Campaign live"}</Toast>
      </div>
    );
  }
  if (scene === "ai") {
    const lines = fr
      ? ["Rédige une publication pour notre", "spécial du midi, ton chaleureux."]
      : ["Write a post for our lunch", "special, in a warm tone."];
    return (
      <div className="absolute inset-0 bg-[#F4F7FC] p-4 sm:p-5">
        <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-[#1F8BFF] px-3 py-2 text-[12px] text-white sm:text-[13px]">
          {lines.join(" ")}
        </div>
        <div className={`mt-3 flex gap-2 transition-all duration-500 ${step >= 1 ? "opacity-100" : "opacity-0"}`}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#060D1F] text-[#29C3FF]">
            <Bot size={14} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#1565D8]">TAK-TAK</p>
            {step < 2 ? (
              <span className="mt-1.5 flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </span>
            ) : (
              <p className="mt-1 text-[12px] leading-5 text-slate-800 sm:text-[13px]">
                {fr
                  ? "Le midi, on vous gâte : soupe, plat du jour et café. On vous garde une place ?"
                  : "Lunch is on us to make special: soup, daily dish and coffee. Save you a seat?"}
              </p>
            )}
          </div>
        </div>
        <Toast show={step === 3}>{fr ? "Texte prêt à publier" : "Post ready to publish"}</Toast>
      </div>
    );
  }
  if (scene === "billing") {
    return (
      <div className="absolute inset-0 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[13px] font-bold text-slate-900 sm:text-[15px]">
            <ReceiptText size={16} className="text-[#1F8BFF]" aria-hidden /> {fr ? "Facture #1042" : "Invoice #1042"}
          </p>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${step >= 3 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {step >= 3 ? (fr ? "Payée" : "Paid") : fr ? "Envoyée" : "Sent"}
          </span>
        </div>
        <ul className="mt-3 grid gap-1.5 text-[12px] text-slate-700 sm:text-[13px]">
          {[fr ? "Service rendu" : "Service delivered", fr ? "TPS" : "GST", fr ? "TVQ" : "QST"].map((l, i) => (
            <li
              key={l}
              className={`flex justify-between border-b border-dashed border-slate-200 pb-1.5 transition-opacity duration-500 ${step >= 1 ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {l}
              <span className="h-2 w-12 self-center rounded bg-slate-100" aria-hidden />
            </li>
          ))}
        </ul>
        <span className={`mt-3 inline-flex rounded-full bg-[#1565D8] px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          {fr ? "Payer en ligne" : "Pay online"}
        </span>
        <Toast show={step === 3}>{fr ? "Facture payée, rappel annulé" : "Invoice paid, reminder cancelled"}</Toast>
      </div>
    );
  }
  // phone
  return (
    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(160deg,#0B1B3D,#060D1F)]">
      <div className="text-center">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#1F8BFF] text-white ${step === 1 ? "animate-bounce" : ""}`}>
          <PhoneIncoming size={26} aria-hidden />
        </span>
        <p className="mt-3 text-[15px] font-semibold text-white">{fr ? "Appel entrant · Ligne Ventes" : "Incoming call · Sales line"}</p>
        <p className={`mt-1 text-[13px] text-white/60 transition-opacity duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          {fr ? "Standard : 1 Ventes · 2 Soutien · 3 Heures" : "Attendant: 1 Sales · 2 Support · 3 Hours"}
        </p>
      </div>
      <Toast show={step === 3}>{fr ? "Appel dirigé vers la bonne personne" : "Call routed to the right person"}</Toast>
    </div>
  );
}


/**
 * Plays a scene in a loop while `active` (in view): working, built, success,
 * then again. Reduced motion: the finished screen only.
 */
export function useScenePlayer(active: boolean, key: string): Step {
  const reduced = useReducedMotion();
  const [step, setStep] = useState<Step>(0);
  useEffect(() => {
    if (reduced) {
      setStep(3);
      return;
    }
    if (!active) return;
    const timers: number[] = [];
    const run = () => {
      setStep(0);
      timers.push(window.setTimeout(() => setStep(1), 350));
      timers.push(window.setTimeout(() => setStep(2), 1600));
      timers.push(window.setTimeout(() => setStep(3), 2800));
      timers.push(window.setTimeout(run, 6800));
    };
    run();
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [active, reduced, key]);
  return step;
}

/** A laptop with a browser bar (read-only address) around a live scene. */
export function LiveLaptop({
  scene,
  step,
  business,
  lang,
  address,
  tab,
}: {
  scene: Scene;
  step: Step;
  business: string;
  lang: Lang;
  address: string;
  tab: string;
}) {
  return (
    <div className="relative">
      <div className="rounded-t-[18px] border-[9px] border-b-0 border-[#1B2436] bg-[#1B2436] shadow-[0_60px_140px_-40px_color-mix(in_oklab,var(--tk-accent,#1F8BFF)_70%,transparent)]">
        <div className="overflow-hidden rounded-t-[8px] bg-[#F1F4F9]">
          <div className="flex items-end gap-1 bg-[#DCE3EE] px-2 pt-1.5">
            <span className="flex gap-1 px-1 pb-2" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
            </span>
            <span className="flex max-w-[60%] items-center gap-1.5 truncate rounded-t-lg bg-[#F1F4F9] px-3 py-1.5 text-[11px] font-semibold text-slate-700">
              <span className="grid h-3.5 w-3.5 place-items-center rounded-sm bg-[#060D1F] text-[7px] font-black text-[#29C3FF]">T</span>
              {tab}
            </span>
          </div>
          <div className="border-b border-slate-200 bg-[#F1F4F9] px-2 py-1.5">
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12.5px] text-slate-600 ring-1 ring-slate-200">
              <LockKeyhole size={12} className="shrink-0 text-emerald-600" aria-hidden />
              <span className="truncate">{address}</span>
            </div>
          </div>
          <div className="relative aspect-[16/9] overflow-hidden">
            <LiveScreen scene={scene} step={step} business={business} lang={lang} />
          </div>
        </div>
      </div>
      <div className="relative h-4 rounded-b-[14px] bg-[linear-gradient(180deg,#C9D3E0,#8E9AAB)]">
        <span className="absolute left-1/2 top-0 h-1.5 w-24 -translate-x-1/2 rounded-b-md bg-[#7A8699]" />
      </div>
    </div>
  );
}
