import Link from "next/link";

import { RedirectCheckForm } from "@/components/web-hosting/redirect-check-form";

export const dynamic = "force-dynamic";

export default function RedirectsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Redirections · Redirects</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Vérifiez où mène un lien : anciennes pages, liens imprimés, version http ou www. Le vérificateur signale les boucles, les chaînes
          trop longues et les redirections temporaires · Check where a link leads: old pages, printed links, http or www versions.
        </p>
      </div>
      <RedirectCheckForm />
      <p className="text-xs text-slate-500">
        Pour ajouter ou changer une redirection, l’équipe s’en occupe · To add or change a redirect, the team handles it:{" "}
        <Link href="/dashboard/support" className="font-semibold text-emerald-700 hover:underline">Demander · Ask</Link>
      </p>
    </div>
  );
}
