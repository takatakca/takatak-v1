import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  consentLanguage,
  consentLoginPath,
  consentPagePath,
  parseAuthorizationId,
  readAuthorizationResult,
  type ConsentLanguage,
  type ConsentScreenModel,
} from "@/lib/auth/oauth-consent";
import { createSupabaseServerClient, getSessionUser } from "@/lib/auth/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ConsentSearch = {
  authorization_id?: string | string[];
  lang?: string | string[];
};

const COPY = {
  fr: {
    title: "Autoriser l’accès",
    eyebrow: "GROUPE TAKATAK",
    tagline: "Digital Solutions. Real Results.",
    intro: (app: string) => `${app} demande l’accès à votre compte TAKATAK.`,
    application: "Application",
    returnAddress: "Adresse de retour",
    account: "Compte",
    scopes: "Accès demandé",
    emptyScopes: "Aucun accès supplémentaire n’est demandé.",
    note: "TAKATAK ne transmet votre choix qu’à cette adresse de retour.",
    allow: "Autoriser",
    refuse: "Refuser",
    switchLabel: "English",
    missing: "Cette demande d’autorisation est incomplète. Revenez à l’application et recommencez.",
    unread: "TAKATAK ne peut pas lire cette demande. Revenez à l’application et recommencez.",
    unsafe: "Cette adresse de retour n’est pas autorisée. TAKATAK ne vous y enverra pas.",
  },
  en: {
    title: "Authorize access",
    eyebrow: "GROUPE TAKATAK",
    tagline: "Digital Solutions. Real Results.",
    intro: (app: string) => `${app} is asking to access your TAKATAK account.`,
    application: "Application",
    returnAddress: "Return address",
    account: "Account",
    scopes: "Requested access",
    emptyScopes: "No extra access is requested.",
    note: "TAKATAK sends your choice only to this return address.",
    allow: "Authorize",
    refuse: "Refuse",
    switchLabel: "Français",
    missing: "This authorization request is incomplete. Return to the application and start again.",
    unread: "TAKATAK cannot read this request. Return to the application and start again.",
    unsafe: "This return address is not allowed. TAKATAK will not send you there.",
  },
} as const;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ConsentSearch>;
}): Promise<Metadata> {
  const params = await searchParams;
  const language = consentLanguage(singleQuery(params.lang));
  const title = COPY[language].title;
  return {
    title: { absolute: `${title} — TAKATAK` },
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
  };
}

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<ConsentSearch>;
}) {
  const params = await searchParams;
  const language = consentLanguage(singleQuery(params.lang));
  const authorizationId = parseAuthorizationId(singleQuery(params.authorization_id));
  const copy = COPY[language];

  if (!authorizationId) {
    return (
      <ConsentFrame language={language} authorizationId={null}>
        <h1 className="text-2xl font-extrabold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#B8C4D3]">{copy.missing}</p>
      </ConsentFrame>
    );
  }

  const user = await getSessionUser();
  if (!user) {
    redirect(consentLoginPath(authorizationId, language));
  }

  const supabase = await createSupabaseServerClient({ persistSessionCookies: false });
  if (!supabase) {
    return (
      <ConsentFrame language={language} authorizationId={authorizationId}>
        <h1 className="text-2xl font-extrabold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#B8C4D3]">{copy.unread}</p>
      </ConsentFrame>
    );
  }

  const details = await supabase.auth.oauth
    .getAuthorizationDetails(authorizationId)
    .catch(() => null);

  if (!details || details.error || !details.data) {
    return (
      <ConsentFrame language={language} authorizationId={authorizationId}>
        <h1 className="text-2xl font-extrabold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#B8C4D3]">{copy.unread}</p>
      </ConsentFrame>
    );
  }

  const view = readAuthorizationResult(
    details.data,
    authorizationId,
    { id: user.id, email: user.email, phone: user.phone },
    language,
  );

  if (view.kind === "redirect") {
    redirect(view.target);
  }

  if (view.kind !== "consent") {
    return (
      <ConsentFrame language={language} authorizationId={authorizationId}>
        <h1 className="text-2xl font-extrabold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#F5C16C]">
          {view.kind === "unsafe-redirect" ? copy.unsafe : copy.unread}
        </p>
      </ConsentFrame>
    );
  }

  return (
    <ConsentFrame language={language} authorizationId={authorizationId}>
      <h1 className="text-2xl font-extrabold tracking-tight">{copy.title}</h1>
      <p className="mt-3 text-sm leading-6 text-[#B8C4D3]">{copy.intro(view.appName)}</p>
      <ConsentFacts copy={copy} view={view} />
      {view.returnAllowed ? (
        <form action="/api/oauth/consent" method="post" className="mt-8">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <input type="hidden" name="lang" value={language} />
          <p className="text-xs leading-5 text-[#B8C4D3]">{copy.note}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              name="decision"
              value="approve"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#1F8BFF] px-4 py-2.5 text-sm font-extrabold text-[#060D1F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#29C3FF]"
            >
              {copy.allow}
            </button>
            <button
              type="submit"
              name="decision"
              value="deny"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#B8C4D3] px-4 py-2.5 text-sm font-semibold text-[#F5F8FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#29C3FF]"
            >
              {copy.refuse}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-6 text-sm leading-6 text-[#F5C16C]">{copy.unsafe}</p>
      )}
    </ConsentFrame>
  );
}

function ConsentFacts({
  copy,
  view,
}: {
  copy: (typeof COPY)[ConsentLanguage];
  view: ConsentScreenModel;
}) {
  return (
    <dl className="mt-6 space-y-4 text-sm">
      <div>
        <dt className="text-xs font-semibold tracking-[0.16em] text-[#29C3FF] uppercase">{copy.application}</dt>
        <dd className="mt-1 break-words text-[#F5F8FC]">{view.appName}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-[0.16em] text-[#29C3FF] uppercase">{copy.returnAddress}</dt>
        <dd className="mt-1 break-all text-[#F5F8FC]">{view.returnAddress}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-[0.16em] text-[#29C3FF] uppercase">{copy.account}</dt>
        <dd className="mt-1 break-all text-[#F5F8FC]">{view.account}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-[0.16em] text-[#29C3FF] uppercase">{copy.scopes}</dt>
        <dd className="mt-2">
          {view.scopes.length === 0 ? (
            <p className="text-[#B8C4D3]">{copy.emptyScopes}</p>
          ) : (
            <ul className="space-y-2">
              {view.scopes.map((scope, index) => (
                <li key={`${index}:${scope}`} className="rounded-lg border border-white/10 bg-[#060D1F] px-3 py-2 text-[#F5F8FC]">
                  {scope}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </div>
    </dl>
  );
}

function ConsentFrame({
  language,
  authorizationId,
  children,
}: {
  language: ConsentLanguage;
  authorizationId: string | null;
  children: React.ReactNode;
}) {
  const other = language === "fr" ? "en" : "fr";
  return (
    <main
      lang={language === "fr" ? "fr-CA" : "en-CA"}
      className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold tracking-[0.28em] text-[#29C3FF]">{COPY[language].eyebrow}</p>
          <p className="mt-2 text-sm text-[#B8C4D3]">{COPY[language].tagline}</p>
        </div>
        <a
          href={consentPagePath(authorizationId, other)}
          className="shrink-0 text-sm font-semibold text-[#29C3FF] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#29C3FF]"
        >
          {COPY[language].switchLabel}
        </a>
      </div>
      <section className="mt-8 rounded-2xl border border-white/10 bg-[#0B1B3D] p-6 shadow-[0_0_40px_rgba(31,139,255,0.18)] sm:p-8">
        {children}
      </section>
    </main>
  );
}

function singleQuery(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}
