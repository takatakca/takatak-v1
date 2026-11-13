"use client";
import Link from "next/link";
import { Activity, BellRing, ChartNoAxesCombined, ArrowRight, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";

export function MonitoringLanding({ enrollmentOpen }: { enrollmentOpen: boolean }) {
  const { lang } = useLanguage();
  const fr = lang === "fr";
  const features = [
    { icon: Activity, title: fr ? "Un contrôle toutes les 5 minutes" : "A check every 5 minutes", description: fr ? "Vérifications HTTPS indépendantes pour détecter les interruptions de votre site." : "Independent HTTPS checks to detect website interruptions." },
    { icon: BellRing, title: fr ? "Des alertes confirmées" : "Confirmed alerts", description: fr ? "Trois échecs confirment une panne; deux réussites confirment le rétablissement. Les alertes sont acheminées au soutien TAKATAK." : "Three failures confirm an outage; two successes confirm recovery. Alerts are routed to TAKATAK support." },
    { icon: ChartNoAxesCombined, title: fr ? "Vos rapports, dans votre tableau de bord" : "Reports in your dashboard", description: fr ? "Consultez les observations et téléchargez vos rapports mensuels CSV." : "Review observations and download monthly CSV reports." },
  ];
  return <main>
    <section className="bg-[#060D1F] px-5 py-20 text-[#F5F8FC] sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#29C3FF]">TAKATAK · {fr ? "Module complémentaire" : "Add-on"}</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">{fr ? "Votre site compte. Gardez-le à l’œil." : "Your website matters. Keep an eye on it."}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#B8C4D3]">{fr ? "La surveillance de sites web, avec votre connexion TAKATAK, votre tableau de bord et votre facturation au même endroit." : "Website monitoring with your TAKATAK sign-in, client dashboard and billing in one place."}</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/register?next=%2Fdashboard%2Fweb-hosting%2Fmonitoring" className="rounded-xl bg-[#1565D8] px-6 py-4 font-semibold">{fr ? "Créer mon compte TAKATAK" : "Create my TAKATAK account"}</Link><Link href="/login?next=%2Fdashboard%2Fweb-hosting%2Fmonitoring" className="rounded-xl border border-[#B8C4D3]/40 px-6 py-4 font-semibold">{fr ? "Déjà client ? Me connecter" : "Already a client? Sign in"}</Link></div>
        </div>
        <aside className="rounded-3xl border border-[#1F8BFF]/40 bg-[#0B1B3D] p-8 sm:p-10">
          <ShieldCheck className="h-10 w-10 text-[#29C3FF]" /><h2 className="mt-5 text-2xl font-bold">Website Monitoring</h2>
          <p className="mt-6"><span className="text-6xl font-bold">5 $</span><span className="ml-2 text-[#B8C4D3]">CAD / {fr ? "mois / site" : "month / site"}</span></p>
          <p className="mt-3 text-sm text-[#B8C4D3]">{fr ? "Plus taxes applicables. Abonnement mensuel renouvelé jusqu’à l’annulation. Annulation dans votre espace de facturation." : "Plus applicable taxes. Monthly subscription renews until canceled. Manage cancellation in your billing area."}</p>
          <Link href="/dashboard/web-hosting/monitoring" className="mt-7 flex items-center gap-2 font-semibold text-[#29C3FF]">{fr ? "Choisir mon site et m’abonner" : "Choose my website and subscribe"}<ArrowRight className="h-4 w-4" /></Link>
          <p className="mt-5 text-sm text-amber-200">{enrollmentOpen ? (fr ? "L’activation exige la confirmation du paiement et la première vérification." : "Activation requires payment confirmation and the first check.") : (fr ? "Préparation du lancement. Les inscriptions payantes ouvriront après l’activation du service." : "Preparing for launch. Paid enrollment opens after the service is activated.")}</p>
        </aside>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 py-16"><div className="grid gap-6 md:grid-cols-3">{features.map(feature => <article key={feature.title} className="rounded-2xl border border-slate-200 p-7"><feature.icon className="h-7 w-7 text-[#1565D8]" /><h2 className="mt-5 text-xl font-bold">{feature.title}</h2><p className="mt-3 leading-relaxed text-slate-600">{feature.description}</p></article>)}</div>
      <div className="mt-12 max-w-3xl"><h2 className="text-2xl font-bold">{fr ? "Un service distinct. Un seul compte." : "A dedicated service. One account."}</h2><p className="mt-4 leading-relaxed text-slate-600">{fr ? "Le moteur de surveillance fonctionne séparément des sites surveillés. L’inscription, les autorisations, l’abonnement et les rapports passent par TAKATAK. Ajoutez le service aux sites de votre espace client." : "The monitoring engine runs separately from the websites it watches. Sign-up, permissions, subscription and reports run through TAKATAK. Add the service to websites in your client workspace."}</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">{fr ? "Les rapports décrivent les contrôles observés, et non une disponibilité continue garantie. Une réponse HTTPS ne prouve pas le bon fonctionnement de chaque fonction. La réparation automatique et les alertes d’expiration anticipée de certificat ne sont pas incluses." : "Reports describe observed checks, not guaranteed continuous availability. An HTTPS response does not prove every feature works. Automatic repairs and advance certificate-expiry alerts are not included."}</p>
      </div>
    </section>
  </main>;
}
