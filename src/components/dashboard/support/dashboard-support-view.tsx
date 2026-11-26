"use client";

// Client support page inside the dashboard. The message goes to the TAKATAK
// team through the same request intake as the public contact form, linked to
// the signed-in account. If online sending is paused, the form offers the same
// message as a ready-to-send email, so a client is never left without an answer.
import Link from "next/link";
import { CreditCard, FileText, LifeBuoy, Mail } from "lucide-react";
import { ContactForm } from "@/components/website/support/ContactForm";
import { SUPPORT_EMAIL } from "@/lib/website/live-chat-config";
import { WebsiteProviders } from "@/lib/website/website-providers";

const LINKS = [
  { href: "/dashboard/billing", icon: CreditCard, fr: "Mon forfait et ma facturation", en: "My plan and billing" },
  { href: "/dashboard/invoices", icon: FileText, fr: "Mes factures", en: "My invoices" },
] as const;

export function DashboardSupportView({ email, defaultMessage }: { email: string | null; defaultMessage?: string }) {
  return (
    <WebsiteProviders isAuthenticated email={email} initialLanguage="fr">
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <LifeBuoy size={18} aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Soutien · Support</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Écrivez à l’équipe TAKATAK : votre message est lié à votre compte et une personne vous répond, en
              français ou en anglais.
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
              Write to the TAKATAK team: your message is linked to your account and a person answers, in French or
              English.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ContactForm
              defaultTopic="support"
              topics={["support", "billing", "other"]}
              context="Tableau de bord · Soutien"
              defaultMessage={defaultMessage}
            />
          </section>

          <aside className="space-y-3">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 shadow-sm hover:border-blue-300"
            >
              <Mail size={16} className="text-blue-700" aria-hidden />
              <span>{SUPPORT_EMAIL}</span>
            </a>
            {LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm hover:border-blue-300"
              >
                <item.icon size={16} className="text-blue-700" aria-hidden />
                <span>
                  <span className="block font-medium text-slate-800">{item.fr}</span>
                  <span className="block text-xs text-slate-500">{item.en}</span>
                </span>
              </Link>
            ))}
            <p className="px-1 text-xs leading-relaxed text-slate-500">
              N’envoyez jamais de mot de passe, de numéro de carte ou de code de vérification.
            </p>
          </aside>
        </div>
      </div>
    </WebsiteProviders>
  );
}
