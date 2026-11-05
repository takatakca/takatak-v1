import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, ShieldCheck } from "lucide-react";

import { LegacyTransferRequestForm } from "@/components/website/transfer/LegacyTransferRequestForm";

export const metadata: Metadata = {
  title: "Demander un transfert de domaine ou de site Web | TAKATAK",
  description: "Ancien client ou nouveau client : demandez le transfert de votre domaine ou de votre site Web vers TAKATAK.",
  alternates: { canonical: "/transfert" },
};

export default function TransferRequestPage() {
  return (
    <main className="min-h-[70vh] bg-[#060D1F] px-4 py-12 text-[#F5F8FC] sm:px-6 lg:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-[#0B1B3D] px-4 py-2 text-sm text-[#29C3FF]">
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          GROUPE TAKATAK · Migration des services
        </div>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">
          Notre serveur a déménagé. Votre transfert commence ici.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[#B8C4D3] sm:text-lg">
          Vous utilisiez notre ancienne plateforme? Remplissez ce formulaire pour demander le
          transfert de votre site Web, de votre domaine ou des deux vers TAKATAK.CA.
          Votre site actuel et vos courriels restent inchangés tant que la migration n'est pas approuvée.
        </p>
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_270px]">
          <LegacyTransferRequestForm />
          <aside className="h-fit rounded-2xl border border-white/15 bg-[#0B1B3D] p-5">
            <ShieldCheck className="h-7 w-7 text-[#29C3FF]" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold">Sans interruption surprise</h2>
            <p className="mt-3 text-sm leading-7 text-[#B8C4D3]">
              Une demande n'est pas un transfert automatique. Notre équipe vérifie d'abord
              l'identité du titulaire, les services concernés, les modalités et les frais applicables.
              Aucun paiement n'est prélevé par ce formulaire.
            </p>
            <p className="mt-4 text-sm leading-7 text-[#B8C4D3]">
              Ne fournissez jamais de mot de passe, de code EPP, de clé API ou de données bancaires
              dans ce formulaire. Nous organiserons un canal sécurisé si nécessaire.
            </p>
            <Link href="/login" className="mt-6 inline-flex text-sm font-semibold text-[#29C3FF] underline underline-offset-4">
              Déjà client? Accéder à TAKATAK
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
