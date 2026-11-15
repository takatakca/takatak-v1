import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";
import { sc4nnerAuthorizeDecision } from "@/lib/experiences/sc4nner-experience-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATE_RE = /^[A-Za-z0-9_-]{43}$/;

type AuthorizeSearch = { state?: string | string[] };

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: "Autoriser SC4NNER — TAKATAK" },
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
  };
}

// The account step that was missing (owner's order, 2026-11-15): before
// anything is authorized, the identified TAKATAK account is SHOWN — its
// email — with a way to switch accounts, and nobody reaches this page
// without an account (no session → login, which offers account creation).
// The launch code is created only when the shown account confirms, and it
// is bound to that account; confirming also provisions its SC4NNER copy.
export default async function Sc4nnerAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<AuthorizeSearch>;
}) {
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : "";

  if (!STATE_RE.test(state)) {
    return (
      <Frame>
        <h1 className="text-2xl font-extrabold tracking-tight">Autoriser SC4NNER</h1>
        <p className="mt-3 text-sm leading-6 text-[#B8C4D3]">
          Cette demande d’autorisation est incomplète. Revenez à SC4NNER et recommencez.
        </p>
      </Frame>
    );
  }

  const launchPath =
    "/api/experiences/sc4nner/launch?state=" + encodeURIComponent(state);
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=" + encodeURIComponent(launchPath));
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });
  const decision = sc4nnerAuthorizeDecision({
    hasUser: true,
    syncOutcome: sync.outcome,
  });
  if (decision !== "confirm") {
    return (
      <Frame>
        <h1 className="text-2xl font-extrabold tracking-tight">Autoriser SC4NNER</h1>
        <p className="mt-3 text-sm leading-6 text-[#F5C16C]">
          {decision === "denied"
            ? "Ce compte TAKATAK n’a pas accès à SC4NNER."
            : "TAKATAK ne peut pas vérifier votre compte pour le moment. Réessayez dans un moment."}
        </p>
      </Frame>
    );
  }

  const prisma = getPrisma();
  const identity = prisma
    ? await prisma.masterIdentity.findUnique({
        where: { authUserId: user.id },
        select: {
          primaryEmail: true,
          primaryPhone: true,
          firstName: true,
          lastName: true,
          accountStatus: true,
        },
      })
    : null;
  if (identity?.accountStatus && identity.accountStatus !== "active") {
    return (
      <Frame>
        <h1 className="text-2xl font-extrabold tracking-tight">Autoriser SC4NNER</h1>
        <p className="mt-3 text-sm leading-6 text-[#F5C16C]">
          Ce compte TAKATAK n’a pas accès à SC4NNER.
        </p>
      </Frame>
    );
  }

  const name =
    [identity?.firstName, identity?.lastName].filter(Boolean).join(" ").trim() ||
    null;
  const email = identity?.primaryEmail || user.email || null;
  // The account is identified by its email whenever the account has one;
  // phone-first TAKATAK accounts (mobile + SMS signup) show their phone.
  const accountLabel =
    email || identity?.primaryPhone || user.phone || name || "Compte TAKATAK";

  let sc4nnerOrigin: string | null = null;
  try {
    sc4nnerOrigin = new URL(
      process.env.SC4NNER_EXPERIENCE_CALLBACK_URL || "",
    ).origin;
  } catch {
    sc4nnerOrigin = null;
  }

  return (
    <Frame>
      <h1 className="text-2xl font-extrabold tracking-tight">Autoriser SC4NNER</h1>
      <p className="mt-3 text-sm leading-6 text-[#B8C4D3]">
        SC4NNER, le studio d’étiquettes de TAKATAK, demande l’accès à votre
        compte TAKATAK.
      </p>
      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-xs font-semibold tracking-[0.16em] text-[#29C3FF] uppercase">
            Application
          </dt>
          <dd className="mt-1 break-words text-[#F5F8FC]">SC4NNER</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-[0.16em] text-[#29C3FF] uppercase">
            Compte
          </dt>
          <dd className="mt-1 break-all text-[#F5F8FC]">{accountLabel}</dd>
          {name && email ? (
            <dd className="mt-1 break-words text-[#B8C4D3]">{name}</dd>
          ) : null}
        </div>
      </dl>
      <p className="mt-6 text-xs leading-5 text-[#B8C4D3]">
        En autorisant, ce compte est lié à SC4NNER : une copie de votre
        compte (nom et courriel) est créée pour le studio et conservée dans
        la base TAKATAK. Aucune donnée d’étiquette n’est transmise.
      </p>
      <form
        action="/api/experiences/sc4nner/launch/confirm"
        method="post"
        className="mt-6"
      >
        <input type="hidden" name="state" value={state} />
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1F8BFF] px-4 py-2.5 text-sm font-extrabold text-[#060D1F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#29C3FF]"
        >
          Autoriser et continuer
        </button>
      </form>
      <div className="mt-4 flex flex-col gap-2 text-sm">
        <a
          href={`/api/experiences/sc4nner/switch?state=${encodeURIComponent(state)}`}
          className="font-semibold text-[#29C3FF] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#29C3FF]"
        >
          Changer de compte
        </a>
        {sc4nnerOrigin ? (
          <a
            href={`${sc4nnerOrigin}/?auth=refused`}
            className="font-semibold text-[#B8C4D3] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#29C3FF]"
          >
            Annuler et retourner à SC4NNER
          </a>
        ) : null}
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main
      lang="fr-CA"
      className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16"
    >
      <div>
        <p className="text-xs font-extrabold tracking-[0.28em] text-[#29C3FF]">
          GROUPE TAKATAK
        </p>
        <p className="mt-2 text-sm text-[#B8C4D3]">
          Digital Solutions. Real Results.
        </p>
      </div>
      <section className="mt-8 rounded-2xl border border-white/10 bg-[#0B1B3D] p-6 shadow-[0_0_40px_rgba(31,139,255,0.18)] sm:p-8">
        {children}
      </section>
    </main>
  );
}
