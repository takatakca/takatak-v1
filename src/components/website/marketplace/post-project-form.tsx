"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import {
  Check,
  CheckCircle2,
  Save,
  ShieldCheck,
} from "lucide-react";

import { FileUploadPanel } from "@/components/website/marketplace/file-upload-panel";
import {
  getMarketplacePackage,
  MARKETPLACE_CATEGORIES,
} from "@/lib/website/marketplace-catalog";
import {
  clearQuotePrefill,
  readQuotePrefill,
} from "@/lib/website/marketplace-storage";
import { categoryName, packageTitle } from "@/lib/website/marketplace-i18n";
import { detectLanguage, type Language } from "@/lib/website/i18n";
import { useLanguage } from "@/lib/website/use-language";
import {
  submitWebsiteRequest,
  uploadWebsiteAttachment,
} from "@/lib/website/website-requests";

type Visibility =
  | "private"
  | "invite_only"
  | "open_to_takatak";

const draftKey =
  "takatak.project.draft.v1";

type Notice =
  | { kind: "draft" }
  | { kind: "prefilled"; title: string };

type SubmitError = "contact" | "invalid" | "rate" | "failed";

const COPY = {
  back: { fr: "← Retour à la place de marché", en: "← Back to marketplace" },
  title: { fr: "Publier un projet", en: "Post a project" },
  lead: {
    fr: "Dites à TAKATAK ce dont vous avez besoin. Nous organisons le brief, la portée, les échanges, les étapes et la livraison.",
    en: "Tell TAKATAK what you need. We organize the brief, scope, communication, milestones, and delivery process.",
  },
  managed: { fr: "Projet encadré par TAKATAK", en: "TAKATAK-managed engagement" },
  draftRestored: { fr: "Votre brouillon enregistré a été restauré.", en: "Your saved draft was restored." },
  prefilled: { fr: "Rempli à partir de « {t} ».", en: "Prefilled from “{t}”." },
  basics: { fr: "1. L’essentiel du projet", en: "1. Project basics" },
  projectTitle: { fr: "Titre du projet", en: "Project title" },
  projectTitlePh: { fr: "ex. : Site web de 5 pages pour ma boulangerie", en: "e.g. Build a 5-page website for my bakery" },
  business: { fr: "Nom de l’entreprise", en: "Business name" },
  optional: { fr: "Facultatif", en: "Optional" },
  category: { fr: "Catégorie", en: "Category" },
  describe: { fr: "2. Décrivez votre besoin", en: "2. Describe what you need" },
  briefLabel: { fr: "Description du projet", en: "Project description" },
  briefPh: {
    fr: "Objectifs, clientèle visée, exemples, essentiels et échéances…",
    en: "Goals, target audience, references, must-haves and deadlines…",
  },
  files: { fr: "Fichiers de référence", en: "Reference files" },
  budgetTimeline: { fr: "3. Budget et délai", en: "3. Budget and timeline" },
  budget: { fr: "Budget ($ CA)", en: "Budget (CAD)" },
  budgetPh: { fr: "ex. : 500", en: "e.g. 500" },
  budgetHint: { fr: "Laissez vide pour demander une soumission.", en: "Leave blank to request a quote." },
  timeline: { fr: "Délai", en: "Timeline" },
  urgent: { fr: "Urgent : moins d’une semaine", en: "Urgent — under 1 week" },
  w12: { fr: "1 à 2 semaines", en: "1–2 weeks" },
  w24: { fr: "2 à 4 semaines", en: "2–4 weeks" },
  m13: { fr: "1 à 3 mois", en: "1–3 months" },
  flexible: { fr: "Flexible", en: "Flexible" },
  skills: { fr: "Compétences recherchées", en: "Required skills" },
  skillsPh: { fr: "ex. : WordPress, SEO, rédaction en français", en: "e.g. WordPress, SEO, French copywriting" },
  visibility: { fr: "4. Visibilité", en: "4. Visibility" },
  openLabel: { fr: "Ouvert à TAKATAK", en: "Open to TAKATAK" },
  openDesc: { fr: "TAKATAK examine et organise le projet.", en: "TAKATAK reviews and organizes the project." },
  inviteLabel: { fr: "Sur invitation", en: "Invite only" },
  inviteDesc: {
    fr: "Partagez le projet en privé avec les personnes choisies.",
    en: "Share the project privately with selected participants.",
  },
  privateLabel: { fr: "Privé", en: "Private" },
  privateDesc: {
    fr: "Visible seulement dans votre compte jusqu’à sa publication.",
    en: "Visible only to your account until published.",
  },
  reach: { fr: "5. Comment vous joindre ?", en: "5. How can we reach you?" },
  name: { fr: "Votre nom", en: "Your name" },
  email: { fr: "Courriel", en: "Email" },
  phone: { fr: "Téléphone", en: "Phone" },
  reachHint: {
    fr: "Un courriel ou un numéro de téléphone est requis. TAKATAK s’en sert seulement pour faire le suivi de ce projet.",
    en: "An email or phone number is required. TAKATAK uses it only to follow up on this project.",
  },
  sendingFiles: { fr: "Envoi des fichiers…", en: "Sending files…" },
  sending: { fr: "Envoi…", en: "Sending…" },
  submit: { fr: "Envoyer le projet à TAKATAK", en: "Submit project to TAKATAK" },
  saveDraft: { fr: "Enregistrer le brouillon", en: "Save draft" },
  draftSaved: { fr: "Brouillon enregistré", en: "Draft saved" },
  howTitle: { fr: "Comment TAKATAK organise la livraison", en: "How TAKATAK organizes delivery" },
  how: {
    fr: [
      "Le brief du projet reste lié à votre compte.",
      "Les fichiers et les messages restent dans l’espace de travail.",
      "Les étapes et les révisions restent organisées.",
      "La livraison finale demande votre approbation.",
      "Le soutien peut aider quand un projet demande de l’attention.",
    ],
    en: [
      "The project brief remains connected to your account.",
      "Files and messages remain inside the workspace.",
      "Milestones and revisions remain organized.",
      "The completed delivery requires client review.",
      "Support can assist when a project needs attention.",
    ],
  },
  fixedTitle: { fr: "Vous préférez un forfait fixe ?", en: "Prefer a fixed package?" },
  fixedBody: {
    fr: "Parcourez des forfaits prêts à commander, avec des livrables et des prix clairs.",
    en: "Browse ready-made packages with clear deliverables and pricing.",
  },
  fixedCta: { fr: "Voir les forfaits →", en: "Browse packages →" },
  receivedTitle: { fr: "Projet reçu", en: "Project received" },
  receivedBody: {
    fr: "TAKATAK a reçu votre projet « {t} ». Une personne spécialisée lira le brief et vous contactera pour la portée, le prix et le délai. Rien n’est facturé avant que vous approuviez une soumission.",
    en: "TAKATAK received your project “{t}”. A specialist will review the brief and contact you about scope, pricing and timing. Nothing is charged until you approve a quote.",
  },
  reference: { fr: "Référence : {r}", en: "Reference: {r}" },
  notSent: { fr: " — non envoyé", en: " — not sent" },
  emailFiles: {
    fr: "Envoyez les fichiers marqués ✗ à support@takatak.ca avec votre référence.",
    en: "Email the files marked ✗ to support@takatak.ca with your reference.",
  },
  createAccount: { fr: "Créer un compte", en: "Create an account" },
  errors: {
    contact: {
      fr: "Ajoutez un courriel ou un numéro de téléphone pour que TAKATAK puisse vous joindre.",
      en: "Add an email or phone number so TAKATAK can contact you.",
    },
    invalid: {
      fr: "Certains renseignements semblent invalides. Vérifiez le formulaire et réessayez.",
      en: "Some information looks invalid. Please review the form and try again.",
    },
    rate: {
      fr: "Trop de demandes ont été envoyées. Attendez quelques minutes, puis réessayez.",
      en: "Too many requests were sent. Please wait a few minutes and try again.",
    },
    failed: {
      fr: "Nous n’avons pas pu envoyer votre projet pour l’instant. Votre brouillon est gardé sur cet appareil : réessayez bientôt ou écrivez à support@takatak.ca.",
      en: "We couldn't send your project right now. Your draft is saved on this device — please try again shortly or email support@takatak.ca.",
    },
  },
} as const;

/** Text written into the brief from a package; read by the TAKATAK team, in the visitor's language. */
const PREFILL = {
  quote: { fr: "Soumission : {t}", en: "Quote: {t}" },
  reference: { fr: "Forfait de référence : {t}", en: "Reference package: {t}" },
  tier: { fr: "Formule : {t}", en: "Tier: {t}" },
  addons: { fr: "Options : {t}", en: "Add-ons: {t}" },
  none: { fr: "Aucune", en: "None" },
  total: { fr: "Total estimé : {t} $", en: "Estimated total: ${t}" },
  need: { fr: "Ce dont j’ai besoin :", en: "What I need:" },
} as const;

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));

export function PostProjectForm({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const { lang } = useLanguage();

  const searchParams =
    useSearchParams();

  const searchQuery =
    searchParams.toString();

  const [title, setTitle] =
    useState("");

  const [
    businessName,
    setBusinessName,
  ] = useState("");

  const [category, setCategory] =
    useState(
      MARKETPLACE_CATEGORIES[0]
        .slug,
    );

  const [brief, setBrief] =
    useState("");

  const [budget, setBudget] =
    useState("");

  const [timeline, setTimeline] =
    useState("2_4_weeks");

  const [skills, setSkills] =
    useState("");

  const [
    visibility,
    setVisibility,
  ] =
    useState<Visibility>(
      "open_to_takatak",
    );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [draftSaved, setDraftSaved] =
    useState(false);

  const [contactName, setContactName] =
    useState("");

  const [contactEmail, setContactEmail] =
    useState("");

  const [contactPhone, setContactPhone] =
    useState("");

  // Hidden field; real visitors never fill it.
  const [website, setWebsite] =
    useState("");

  const [reference, setReference] =
    useState<string | null>(null);

  const [files, setFiles] =
    useState<File[]>([]);

  const [uploadReport, setUploadReport] =
    useState<{ name: string; sent: boolean }[]>([]);

  const [uploading, setUploading] =
    useState(false);

  const [submitError, setSubmitError] =
    useState<SubmitError | null>(null);

  const [
    prefillMessage,
    setPrefillMessage,
  ] = useState<Notice | null>(null);

  useEffect(() => {
    function restoreDraft() {
      try {
        const raw =
          window.localStorage.getItem(
            draftKey,
          );
        if (!raw) return;
        const draft = JSON.parse(
          raw,
        ) as Record<string, unknown>;
        const read = (key: string) =>
          typeof draft[key] === "string"
            ? (draft[key] as string)
            : "";
        if (read("title")) setTitle(read("title"));
        if (read("businessName")) setBusinessName(read("businessName"));
        if (
          MARKETPLACE_CATEGORIES.some(
            (item) => item.slug === read("category"),
          )
        ) {
          setCategory(read("category"));
        }
        if (read("brief")) setBrief(read("brief"));
        if (read("budget")) setBudget(read("budget"));
        if (read("timeline")) setTimeline(read("timeline"));
        if (read("skills")) setSkills(read("skills"));
        setPrefillMessage({ kind: "draft" });
      } catch {
        /* a corrupt draft is ignored */
      }
    }

    const timeoutId =
      window.setTimeout(() => {
        // The language provider settles after mount; read the stored choice directly.
        const prefillLang: Language = detectLanguage();
        const pf = (key: keyof typeof PREFILL, t = "") => fill(PREFILL[key][prefillLang], { t });

        const currentParams =
          new URLSearchParams(
            searchQuery,
          );

        const packageId =
          currentParams.get(
            "package",
          );

        const categoryParam =
          currentParams.get(
            "category",
          );

        if (
          categoryParam &&
          MARKETPLACE_CATEGORIES.some(
            (item) =>
              item.slug ===
              categoryParam,
          )
        ) {
          setCategory(
            categoryParam,
          );
        }

        if (packageId) {
          const packageItem =
            getMarketplacePackage(
              packageId,
            );

          if (packageItem) {
            const packageName = packageTitle(packageItem, prefillLang);

            setTitle(
              pf("quote", packageName),
            );

            setCategory(
              packageItem.category,
            );

            setBrief(
              `${pf("reference", packageName)}\n\n${pf("need")}\n`,
            );

            setBudget(
              String(
                Math.round(
                  Math.min(
                    ...packageItem.tiers.map(
                      (item) =>
                        item.priceCents,
                    ),
                  ) / 100,
                ),
              ),
            );

            setPrefillMessage({ kind: "prefilled", title: packageName });

            return;
          }
        }

        const prefill =
          readQuotePrefill();

        if (!prefill) {
          restoreDraft();
          return;
        }

        const prefillName = packageTitle({ id: prefill.packageId, title: prefill.title }, prefillLang);

        setTitle(
          pf("quote", `${prefillName} (${prefill.tierName})`),
        );

        setCategory(
          prefill.category,
        );

        setBrief(
          [
            pf("reference", prefillName),
            pf("tier", prefill.tierName),
            pf(
              "addons",
              prefill.addons.map((item) => item.label).join(", ") || pf("none"),
            ),
            pf("total", String(Math.round(prefill.totalCents / 100))),
            "",
            pf("need"),
            "",
          ].join("\n"),
        );

        setBudget(
          String(
            Math.round(
              prefill.totalCents /
                100,
            ),
          ),
        );

        setPrefillMessage({ kind: "prefilled", title: prefillName });
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [searchQuery]);

  function projectPayload() {
    return {
      title,
      businessName,
      category,
      brief,
      budget,
      timeline,
      skills,
      visibility,
      savedAt:
        new Date().toISOString(),
    };
  }

  function saveDraft() {
    window.localStorage.setItem(
      draftKey,
      JSON.stringify(
        projectPayload(),
      ),
    );

    setDraftSaved(true);

    window.setTimeout(
      () =>
        setDraftSaved(false),
      2500,
    );
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitError(null);

    if (
      !isAuthenticated &&
      !contactEmail.trim() &&
      !contactPhone.trim()
    ) {
      setSubmitError("contact");
      return;
    }

    setSubmitting(true);

    // Keep a local copy until TAKATAK confirms reception.
    window.localStorage.setItem(
      draftKey,
      JSON.stringify(
        projectPayload(),
      ),
    );

    const details = [
      brief,
      skills ? `Required skills: ${skills}` : "",
      `Visibility: ${visibility}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result =
      await submitWebsiteRequest({
        kind: "project_request",
        title,
        company:
          businessName || undefined,
        category,
        budget: budget || undefined,
        timeline,
        message: details,
        name:
          contactName || undefined,
        email:
          contactEmail || undefined,
        phone:
          contactPhone || undefined,
        sourcePage:
          window.location.pathname,
        website,
      });

    setSubmitting(false);

    if (result.status === "sent") {
      window.localStorage.removeItem(
        draftKey,
      );
      clearQuotePrefill();

      // Reference files go up one by one, only after the project is received.
      if (files.length > 0) {
        setUploading(true);
        const report: { name: string; sent: boolean }[] = [];
        for (const file of files) {
          const upload = result.uploadToken
            ? await uploadWebsiteAttachment(result.uploadToken, file)
            : { status: "failed" as const };
          report.push({ name: file.name, sent: upload.status === "uploaded" });
        }
        setUploadReport(report);
        setUploading(false);
      }

      setReference(result.reference);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (result.status === "invalid") {
      setSubmitError(
        result.fieldErrors.contact ? "contact" : "invalid",
      );
      return;
    }

    if (result.status === "rate_limited") {
      setSubmitError("rate");
      return;
    }

    setSubmitError("failed");
  }

  if (reference) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2
              size={24}
              className="mt-0.5 shrink-0 text-emerald-700"
            />

            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                {COPY.receivedTitle[lang]}
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                {fill(COPY.receivedBody[lang], { t: title })}
              </p>

              <p className="mt-3 text-sm font-medium text-slate-900">
                {fill(COPY.reference[lang], { r: reference })}
              </p>

              {uploadReport.length > 0 ? (
                <div className="mt-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{COPY.files[lang]}</p>
                  <ul className="mt-1 space-y-0.5">
                    {uploadReport.map((item) => (
                      <li key={item.name}>
                        {item.sent ? "✓" : "✗"} {item.name}
                        {item.sent ? "" : COPY.notSent[lang]}
                      </li>
                    ))}
                  </ul>
                  {uploadReport.some((item) => !item.sent) ? (
                    <p className="mt-2 text-xs text-slate-600">
                      {COPY.emailFiles[lang]}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/marketplace"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  {COPY.back[lang].replace("← ", "")}
                </Link>

                {!isAuthenticated ? (
                  <Link
                    href="/register"
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                  >
                    {COPY.createAccount[lang]}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link
        href="/marketplace"
        className="text-xs text-slate-500 transition hover:text-slate-950"
      >
        {COPY.back[lang]}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">
            {COPY.title[lang]}
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            {COPY.lead[lang]}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-primary">
          <ShieldCheck size={14} />
          {COPY.managed[lang]}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
        <form
          onSubmit={submit}
          className="space-y-6"
        >
          {prefillMessage ? (
            <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-primary">
              {prefillMessage.kind === "draft"
                ? COPY.draftRestored[lang]
                : fill(COPY.prefilled[lang], { t: prefillMessage.title })}
            </div>
          ) : null}

          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              {COPY.basics[lang]}
            </h2>

            <div>
              <label htmlFor="pp-title" className="mb-1 block text-sm font-medium text-slate-700">
                {COPY.projectTitle[lang]}
              </label>

              <input
                id="pp-title"
                value={title}
                onChange={(event) =>
                  setTitle(
                    event.target.value,
                  )
                }
                required
                maxLength={200}
                placeholder={COPY.projectTitlePh[lang]}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pp-business" className="mb-1 block text-sm font-medium text-slate-700">
                  {COPY.business[lang]}
                </label>

                <input
                  id="pp-business"
                  value={businessName}
                  onChange={(event) =>
                    setBusinessName(
                      event.target.value,
                    )
                  }
                  maxLength={120}
                  placeholder={COPY.optional[lang]}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="pp-category" className="mb-1 block text-sm font-medium text-slate-700">
                  {COPY.category[lang]}
                </label>

                <select
                  id="pp-category"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {MARKETPLACE_CATEGORIES.map(
                    (item) => (
                      <option
                        key={item.slug}
                        value={item.slug}
                      >
                        {categoryName(item.slug, item.name, lang)}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              {COPY.describe[lang]}
            </h2>

            <textarea
              value={brief}
              onChange={(event) =>
                setBrief(
                  event.target.value,
                )
              }
              required
              aria-label={COPY.briefLabel[lang]}
              rows={7}
              maxLength={5000}
              placeholder={COPY.briefPh[lang]}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />

            <div>
              <p className="mb-1 block text-sm font-medium text-slate-700">
                {COPY.files[lang]}
              </p>

              <FileUploadPanel
                lang={lang}
                files={files}
                onChange={setFiles}
                disabled={submitting || uploading}
              />
            </div>
          </section>

          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              {COPY.budgetTimeline[lang]}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pp-budget" className="mb-1 block text-sm font-medium text-slate-700">
                  {COPY.budget[lang]}
                </label>

                <input
                  id="pp-budget"
                  value={budget}
                  onChange={(event) =>
                    setBudget(
                      event.target.value,
                    )
                  }
                  type="number"
                  min="0"
                  step="1"
                  placeholder={COPY.budgetPh[lang]}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />

                <p className="mt-1 text-xs text-slate-500">
                  {COPY.budgetHint[lang]}
                </p>
              </div>

              <div>
                <label htmlFor="pp-timeline" className="mb-1 block text-sm font-medium text-slate-700">
                  {COPY.timeline[lang]}
                </label>

                <select
                  id="pp-timeline"
                  value={timeline}
                  onChange={(event) =>
                    setTimeline(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="urgent">
                    {COPY.urgent[lang]}
                  </option>

                  <option value="1_2_weeks">
                    {COPY.w12[lang]}
                  </option>

                  <option value="2_4_weeks">
                    {COPY.w24[lang]}
                  </option>

                  <option value="1_3_months">
                    {COPY.m13[lang]}
                  </option>

                  <option value="flexible">
                    {COPY.flexible[lang]}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pp-skills" className="mb-1 block text-sm font-medium text-slate-700">
                {COPY.skills[lang]}
              </label>

              <input
                id="pp-skills"
                value={skills}
                onChange={(event) =>
                  setSkills(
                    event.target.value,
                  )
                }
                maxLength={200}
                placeholder={COPY.skillsPh[lang]}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              {COPY.visibility[lang]}
            </h2>

            {[
              {
                value:
                  "open_to_takatak" as const,
                label: COPY.openLabel[lang],
                description: COPY.openDesc[lang],
              },
              {
                value:
                  "invite_only" as const,
                label: COPY.inviteLabel[lang],
                description: COPY.inviteDesc[lang],
              },
              {
                value:
                  "private" as const,
                label: COPY.privateLabel[lang],
                description: COPY.privateDesc[lang],
              },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                  visibility ===
                  option.value
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  checked={
                    visibility ===
                    option.value
                  }
                  onChange={() =>
                    setVisibility(
                      option.value,
                    )
                  }
                  className="mt-1"
                />

                <span>
                  <span className="font-medium text-slate-950">
                    {option.label}
                  </span>

                  <span className="mt-0.5 block text-xs text-slate-500">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </section>

          {!isAuthenticated ? (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-950">
                {COPY.reach[lang]}
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <input
                  value={contactName}
                  onChange={(event) =>
                    setContactName(
                      event.target.value,
                    )
                  }
                  maxLength={120}
                  autoComplete="name"
                  aria-label={COPY.name[lang]}
                  placeholder={COPY.name[lang]}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />

                <input
                  value={contactEmail}
                  onChange={(event) =>
                    setContactEmail(
                      event.target.value,
                    )
                  }
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  aria-label={COPY.email[lang]}
                  placeholder={COPY.email[lang]}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />

                <input
                  value={contactPhone}
                  onChange={(event) =>
                    setContactPhone(
                      event.target.value,
                    )
                  }
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  aria-label={COPY.phone[lang]}
                  placeholder={COPY.phone[lang]}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <p className="text-xs text-slate-500">
                {COPY.reachHint[lang]}
              </p>
            </section>
          ) : null}

          <div
            aria-hidden="true"
            className="absolute -left-[10000px] h-px w-px overflow-hidden"
          >
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) =>
                  setWebsite(
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          {submitError ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {COPY.errors[submitError][lang]}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={submitting || uploading}
              type="submit"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {uploading
                ? COPY.sendingFiles[lang]
                : submitting
                  ? COPY.sending[lang]
                  : COPY.submit[lang]}
            </button>

            <button
              type="button"
              onClick={saveDraft}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <Save size={14} />
              {COPY.saveDraft[lang]}
            </button>

            {draftSaved ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                <Check size={12} />
                {COPY.draftSaved[lang]}
              </span>
            ) : null}
          </div>
        </form>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="flex items-center gap-2 font-semibold text-slate-950">
              <ShieldCheck
                size={16}
                className="text-primary"
              />

              {COPY.howTitle[lang]}
            </h3>

            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {COPY.how[lang].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2"
                >
                  <Check
                    size={14}
                    className="mt-1 shrink-0 text-primary"
                  />

                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-950">
              {COPY.fixedTitle[lang]}
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              {COPY.fixedBody[lang]}
            </p>

            <Link
              href="/marketplace"
              className="mt-3 inline-flex text-sm font-semibold text-primary"
            >
              {COPY.fixedCta[lang]}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}