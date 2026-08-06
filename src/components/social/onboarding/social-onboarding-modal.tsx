"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Link2,
  Loader2,
  MessagesSquare,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

type Persona =
  | "creator"
  | "company_manager"
  | "freelancer"
  | "agency";

type TeamMode =
  | "solo"
  | "team";

type Goal =
  | "planning"
  | "analytics"
  | "smartlinks"
  | "inbox";

type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

type OnboardingResponse = {
  ok?: boolean;
  message?: string;
  onboarding?: {
    status: OnboardingStatus;
    persona: Persona | null;
    teamMode: TeamMode | null;
    goals: Goal[];
    lastStep: number;
    shouldShow: boolean;
  };
};

const PERSONA_OPTIONS: Array<{
  value: Persona;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: "creator",
    title: "Content creator",
    description:
      "I manage my own content, audience and personal brand.",
    icon: UserRound,
  },
  {
    value: "company_manager",
    title: "Company manager",
    description:
      "I manage social media for one company or organization.",
    icon: Building2,
  },
  {
    value: "freelancer",
    title: "Freelancer",
    description:
      "I manage social accounts for different clients.",
    icon: BriefcaseBusiness,
  },
  {
    value: "agency",
    title: "Marketing agency",
    description:
      "My team manages multiple brands, clients and campaigns.",
    icon: UsersRound,
  },
];

const TEAM_OPTIONS: Array<{
  value: TeamMode;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: "solo",
    title: "Just me",
    description:
      "I will manage the social workspace by myself.",
    icon: UserRound,
  },
  {
    value: "team",
    title: "Working with a team",
    description:
      "Other users will collaborate with me in this workspace.",
    icon: UsersRound,
  },
];

const GOAL_OPTIONS: Array<{
  value: Goal;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: "planning",
    title: "Planning and publishing",
    description:
      "Create, organize and schedule content across social networks.",
    icon: CalendarDays,
  },
  {
    value: "analytics",
    title: "Analytics and reporting",
    description:
      "Understand account performance and prepare reports.",
    icon: BarChart3,
  },
  {
    value: "smartlinks",
    title: "SmartLinks",
    description:
      "Create trackable pages and links for social campaigns.",
    icon: Link2,
  },
  {
    value: "inbox",
    title: "Conversation management",
    description:
      "Organize customer messages, replies and interactions.",
    icon: MessagesSquare,
  },
];

function ChoiceCard({
  selected,
  title,
  description,
  icon: Icon,
  multiple = false,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: LucideIcon;
  multiple?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative flex min-h-[112px] w-full items-start gap-3 rounded-xl border px-4 py-4 text-left transition ${
        selected
          ? "border-[#5c4cff] bg-[#f2f0ff] shadow-[0_0_0_1px_rgba(92,76,255,0.12)]"
          : "border-slate-200 bg-white hover:border-[#b8b0ff] hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
          selected
            ? "bg-[#5c4cff] text-white"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        <Icon
          className="h-5 w-5"
          strokeWidth={1.9}
        />
      </span>

      <span className="min-w-0 flex-1 pr-7">
        <span className="block text-[14px] font-semibold text-slate-950">
          {title}
        </span>

        <span className="mt-1 block text-[12px] leading-5 text-slate-500">
          {description}
        </span>
      </span>

      <span
        className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center border transition ${
          multiple
            ? "rounded-md"
            : "rounded-full"
        } ${
          selected
            ? "border-[#5c4cff] bg-[#5c4cff] text-white"
            : "border-slate-300 bg-white text-transparent"
        }`}
      >
        <Check
          className="h-3.5 w-3.5"
          strokeWidth={2.4}
        />
      </span>
    </button>
  );
}

export function SocialOnboardingModal() {
  const pathname = usePathname();
  const router = useRouter();

  const searchParams = useSearchParams();

const forcePreview =
  process.env.NODE_ENV !==
    "production" &&
  searchParams.get("preview") ===
    "onboarding";

  const [loading, setLoading] =
    useState(true);

  const [visible, setVisible] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [step, setStep] =
    useState(1);

  const [persona, setPersona] =
    useState<Persona | null>(null);

  const [teamMode, setTeamMode] =
    useState<TeamMode | null>(null);

  const [goals, setGoals] =
    useState<Goal[]>([]);

  useEffect(()=> {
    if (pathname !== "/dashboard/social" ||
        forcePreview) {
        return;
    }
    
    let cancelled = false;
    
    async function loadOnboarding() {
        try {
          const response = await fetch(
            "/api/social/onboarding",
            {
              method: "GET",
              cache: "no-store",
              headers: {
                Accept: "application/json",
              },
            },
          );
    
          const result =
            (await response
              .json()
              .catch(() => null)) as OnboardingResponse | null;
    
          if (
            cancelled ||
            !response.ok ||
            !result?.onboarding
          ) {
            return;
          }
    
          setPersona(
            result.onboarding.persona,
          );
    
          setTeamMode(
            result.onboarding.teamMode,
          );
    
          setGoals(
            result.onboarding.goals,
          );
    
          setStep(
            Math.min(
              4,
              Math.max(
                1,
                result.onboarding.lastStep,
              ),
            ),
          );
    
          setVisible(
            result.onboarding.shouldShow,
          );
    } catch {
          if (!cancelled) {
            setVisible(false);
          }
    } finally {
          if (!cancelled) {
            setLoading(false);
          }
    }
    }
    
      void loadOnboarding();
    
      return () => {
        cancelled = true;
      };
    
  }, [forcePreview, pathname]);  

  useEffect(() => {
    if (!visible) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [visible]);

  function leavePreview(
    openConnections = false,
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString(),
      );
  
    params.delete("preview");
  
    if (openConnections) {
      params.set(
        "connections",
        "open",
      );
    } else {
      params.delete("connections");
    }
  
    const query = params.toString();
  
    router.replace(
      `${pathname}${
        query ? `?${query}` : ""
      }`,
      {
        scroll: false,
      },
    );
  }

  function toggleGoal(
    goal: Goal,
  ) {
    setGoals((current) =>
      current.includes(goal)
        ? current.filter(
            (item) =>
              item !== goal,
          )
        : [...current, goal],
    );
  }

  function canContinue() {
    if (step === 1) {
      return persona !== null;
    }

    if (step === 2) {
      return teamMode !== null;
    }

    if (step === 3) {
      return goals.length > 0;
    }

    return true;
  }

  async function updateOnboarding(
    action:
      | "save"
      | "complete"
      | "skip",
    lastStep = step,
  ): Promise<boolean> {
    if (forcePreview) {
        setError(null);
        return true;
      }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/social/onboarding",
        {
          method: "PATCH",
          headers: {
            Accept:
              "application/json",
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action,
            persona,
            teamMode,
            goals,
            lastStep,
          }),
        },
      );

      const result =
        (await response
          .json()
          .catch(
            () => null,
          )) as OnboardingResponse | null;

      if (!response.ok) {
        setError(
          result?.message ??
            "Your onboarding progress could not be saved.",
        );

        return false;
      }

      return true;
    } catch {
      setError(
        "Your onboarding progress could not be saved.",
      );

      return false;
    } finally {
      setSaving(false);
    }
  }

  async function continueStep() {
    if (
      saving ||
      !canContinue()
    ) {
      return;
    }

    const nextStep =
      Math.min(4, step + 1);

    const saved =
      await updateOnboarding(
        "save",
        nextStep,
      );

    if (saved) {
      setStep(nextStep);
    }
  }

  async function goBack() {
    if (
      saving ||
      step <= 1
    ) {
      return;
    }

    const previousStep =
      Math.max(1, step - 1);

    setError(null);
    setStep(previousStep);

    await updateOnboarding(
      "save",
      previousStep,
    );
  }

  async function skipOnboarding() {
    if (saving) {
      return;
    }

    const saved =
      await updateOnboarding(
        "skip",
      );

    if (!saved) {
      return;
    }

    if (forcePreview) {
      leavePreview();
      return;
    }


    setVisible(false);
    router.refresh();
  }

  async function completeOnboarding(
    connectAccounts: boolean,
  ) {
    if (saving) {
      return;
    }

    const saved =
      await updateOnboarding(
        "complete",
        4,
      );

    if (!saved) {
      return;
    }

    if (forcePreview) {
        leavePreview(
          connectAccounts,
        );
        return;
    }

    setVisible(false);

    if (connectAccounts) {
      router.replace(
        "/dashboard/social?connections=open",
      );
      return;
    }

    router.refresh();
  }

  if (
    pathname !==
      "/dashboard/social" || (!forcePreview &&
        (loading || !visible))
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1c101c]/65 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="social-onboarding-title"
      aria-describedby="social-onboarding-description"
    >
      <section className="flex max-h-[calc(100vh-24px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.38)] sm:max-h-[calc(100vh-40px)]">
        <header className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2a1728] text-[#dfff32]">
                <Sparkles
                  className="h-5 w-5"
                  strokeWidth={1.9}
                />
              </span>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5c4cff]">
                  TAKATAK Social
                </p>

                <h1
                  id="social-onboarding-title"
                  className="mt-0.5 truncate text-[18px] font-semibold text-slate-950 sm:text-[20px]"
                >
                  Set up your social workspace
                </h1>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void skipOnboarding();
              }}
              className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-wait disabled:opacity-50"
            >
              Skip
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="grid flex-1 grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map(
                (item) => (
                  <span
                    key={item}
                    className={`h-1 rounded-full transition ${
                      item <= step
                        ? "bg-[#5c4cff]"
                        : "bg-slate-200"
                    }`}
                  />
                ),
              )}
            </div>

            <span className="shrink-0 text-[11px] font-medium text-slate-400">
              {step}/4
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {step === 1 ? (
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                What best describes you?
              </h2>

              <p
                id="social-onboarding-description"
                className="mt-1.5 text-sm leading-6 text-slate-500"
              >
                Choose the option that
                matches how you manage
                social media.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {PERSONA_OPTIONS.map(
                  (option) => (
                    <ChoiceCard
                      key={
                        option.value
                      }
                      selected={
                        persona ===
                        option.value
                      }
                      title={
                        option.title
                      }
                      description={
                        option.description
                      }
                      icon={
                        option.icon
                      }
                      onClick={() => {
                        setPersona(
                          option.value,
                        );
                        setError(null);
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                How will you work?
              </h2>

              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                This prepares the correct
                collaboration experience
                for your workspace.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {TEAM_OPTIONS.map(
                  (option) => (
                    <ChoiceCard
                      key={
                        option.value
                      }
                      selected={
                        teamMode ===
                        option.value
                      }
                      title={
                        option.title
                      }
                      description={
                        option.description
                      }
                      icon={
                        option.icon
                      }
                      onClick={() => {
                        setTeamMode(
                          option.value,
                        );
                        setError(null);
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                How will you use TAKATAK?
              </h2>

              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                Select one or more features.
                You can change your setup
                later.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {GOAL_OPTIONS.map(
                  (option) => (
                    <ChoiceCard
                      key={
                        option.value
                      }
                      selected={goals.includes(
                        option.value,
                      )}
                      title={
                        option.title
                      }
                      description={
                        option.description
                      }
                      icon={
                        option.icon
                      }
                      multiple
                      onClick={() => {
                        toggleGoal(
                          option.value,
                        );
                        setError(null);
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="py-3 text-center sm:py-6">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#efffc5] text-[#2a1728]">
                <Check
                  className="h-7 w-7"
                  strokeWidth={2.2}
                />
              </span>

              <h2 className="mt-5 text-2xl font-semibold text-slate-950">
                Your workspace is ready
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Connect your social
                accounts now or enter the
                dashboard and connect them
                later.
              </p>

              <div className="mx-auto mt-6 grid max-w-md gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void completeOnboarding(
                      true,
                    );
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#dfff32] px-5 text-sm font-semibold text-[#2a1728] transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}

                  Connect social accounts
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void completeOnboarding(
                      false,
                    );
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                  Enter Social dashboard
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {error}
            </p>
          ) : null}
        </div>

        {step < 4 ? (
          <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 px-5 py-3.5 sm:px-7">
            <div>
              {step > 1 ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void goBack();
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <span />
              )}
            </div>

            <button
              type="button"
              disabled={
                saving ||
                !canContinue()
              }
              onClick={() => {
                void continueStep();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#5c4cff] px-5 text-sm font-semibold text-white transition hover:bg-[#4c3ee0] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}

              Continue

              {!saving ? (
                <ChevronRight className="h-4 w-4" />
              ) : null}
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}