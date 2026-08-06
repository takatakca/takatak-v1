import { revalidatePath } from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERSONAS = [
  "creator",
  "company_manager",
  "freelancer",
  "agency",
] as const;

const TEAM_MODES = [
  "solo",
  "team",
] as const;

const GOALS = [
  "planning",
  "analytics",
  "smartlinks",
  "inbox",
] as const;

type Persona =
  (typeof PERSONAS)[number];

type TeamMode =
  (typeof TEAM_MODES)[number];

type Goal =
  (typeof GOALS)[number];

type OnboardingAction =
  | "save"
  | "complete"
  | "skip";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isPersona(
  value: unknown,
): value is Persona {
  return (
    typeof value === "string" &&
    PERSONAS.includes(
      value as Persona,
    )
  );
}

function isTeamMode(
  value: unknown,
): value is TeamMode {
  return (
    typeof value === "string" &&
    TEAM_MODES.includes(
      value as TeamMode,
    )
  );
}

function parseGoals(
  value: unknown,
): Goal[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.filter(
    (item): item is Goal =>
      typeof item === "string" &&
      GOALS.includes(item as Goal),
  );

  if (
    parsed.length !== value.length
  ) {
    return null;
  }

  return Array.from(
    new Set(parsed),
  );
}

function serializeOnboarding(
  onboarding: {
    persona: Persona | null;
    teamMode: TeamMode | null;
    goals: Goal[];
    status:
      | "in_progress"
      | "completed"
      | "skipped";
    lastStep: number;
  } | null,
) {
  if (!onboarding) {
    return {
      status: "not_started",
      persona: null,
      teamMode: null,
      goals: [],
      lastStep: 1,
      shouldShow: true,
    };
  }

  return {
    status: onboarding.status,
    persona: onboarding.persona,
    teamMode: onboarding.teamMode,
    goals: onboarding.goals,
    lastStep: onboarding.lastStep,
    shouldShow:
      onboarding.status ===
      "in_progress",
  };
}

export async function GET(): Promise<NextResponse> {
  const gate =
    await requireWorkspaceApiPermission(
      "view_social",
    );

  if (!gate.ok) {
    return gate.response;
  }

  try {
    const prisma = getPrisma();

    if (!prisma) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Social onboarding is temporarily unavailable.",
        },
        503,
      );
    }

    const onboarding =
      await prisma.socialOnboarding.findUnique(
        {
          where: {
            profileId:
              gate.access.profileId,
          },
          select: {
            persona: true,
            teamMode: true,
            goals: true,
            status: true,
            lastStep: true,
          },
        },
      );

    return jsonResponse(
      {
        ok: true,
        onboarding:
          serializeOnboarding(
            onboarding,
          ),
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-onboarding-read",
      error,
      "Social onboarding could not be loaded.",
    );
  }
}

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse> {
  const gate =
    await requireWorkspaceApiPermission(
      "view_social",
    );

  if (!gate.ok) {
    return gate.response;
  }

  const bodyResult =
    await readJsonBody(
      request,
      8_192,
    );

  if (!bodyResult.ok) {
    return jsonResponse(
      {
        ok: false,
        message:
          bodyResult.message,
      },
      bodyResult.status,
    );
  }

  if (
    !isRecord(bodyResult.body)
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The onboarding request is invalid.",
      },
      400,
    );
  }

  const rawAction =
    bodyResult.body.action;

  if (
    rawAction !== "save" &&
    rawAction !== "complete" &&
    rawAction !== "skip"
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The onboarding action is invalid.",
      },
      400,
    );
  }

  const action: OnboardingAction =
    rawAction;

  try {
    const prisma = getPrisma();

    if (!prisma) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Social onboarding is temporarily unavailable.",
        },
        503,
      );
    }

    if (action === "skip") {
      const onboarding =
        await prisma.$transaction(
          async (transaction) => {
            const record =
              await transaction.socialOnboarding.upsert(
                {
                  where: {
                    profileId:
                      gate.access
                        .profileId,
                  },
                  create: {
                    profileId:
                      gate.access
                        .profileId,
                    status:
                      "skipped",
                    skippedAt:
                      new Date(),
                    lastStep: 1,
                  },
                  update: {
                    status:
                      "skipped",
                    skippedAt:
                      new Date(),
                    completedAt:
                      null,
                  },
                  select: {
                    id: true,
                    persona: true,
                    teamMode: true,
                    goals: true,
                    status: true,
                    lastStep: true,
                  },
                },
              );

            await transaction.auditLog.create(
              {
                data: {
                  profileId:
                    gate.access
                      .profileId,
                  clientId:
                    gate.access
                      .activeClientId,
                  action:
                    "social_onboarding_skipped",
                  entityType:
                    "SocialOnboarding",
                  entityId:
                    record.id,
                },
              },
            );

            return record;
          },
        );

      revalidatePath(
        "/dashboard/social",
      );

      return jsonResponse(
        {
          ok: true,
          onboarding:
            serializeOnboarding(
              onboarding,
            ),
        },
        200,
      );
    }

    const rawPersona =
      bodyResult.body.persona;

    const rawTeamMode =
      bodyResult.body.teamMode;

    const goals = parseGoals(
      bodyResult.body.goals,
    );

    const rawLastStep =
      bodyResult.body.lastStep;

    const persona =
      rawPersona === null
        ? null
        : isPersona(rawPersona)
          ? rawPersona
          : undefined;

    const teamMode =
      rawTeamMode === null
        ? null
        : isTeamMode(
              rawTeamMode,
            )
          ? rawTeamMode
          : undefined;

    if (
      persona === undefined
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Select a valid account type.",
        },
        400,
      );
    }

    if (
      teamMode === undefined
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Select a valid team mode.",
        },
        400,
      );
    }

    if (!goals) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Select valid social-media goals.",
        },
        400,
      );
    }

    const lastStep =
      typeof rawLastStep ===
        "number" &&
      Number.isInteger(
        rawLastStep,
      )
        ? rawLastStep
        : 1;

    if (
      lastStep < 1 ||
      lastStep > 4
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "The onboarding step is invalid.",
        },
        400,
      );
    }

    if (
      action === "complete" &&
      (!persona ||
        !teamMode ||
        goals.length === 0)
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Complete all onboarding questions before finishing.",
        },
        400,
      );
    }

    const status =
      action === "complete"
        ? "completed"
        : "in_progress";

    const completedAt =
      action === "complete"
        ? new Date()
        : null;

    const onboarding =
      await prisma.$transaction(
        async (transaction) => {
          const record =
            await transaction.socialOnboarding.upsert(
              {
                where: {
                  profileId:
                    gate.access
                      .profileId,
                },
                create: {
                  profileId:
                    gate.access
                      .profileId,
                  persona,
                  teamMode,
                  goals,
                  status,
                  lastStep,
                  completedAt,
                },
                update: {
                  persona,
                  teamMode,
                  goals,
                  status,
                  lastStep,
                  completedAt,
                  skippedAt: null,
                },
                select: {
                  id: true,
                  persona: true,
                  teamMode: true,
                  goals: true,
                  status: true,
                  lastStep: true,
                },
              },
            );

          if (
            action ===
            "complete"
          ) {
            await transaction.auditLog.create(
              {
                data: {
                  profileId:
                    gate.access
                      .profileId,
                  clientId:
                    gate.access
                      .activeClientId,
                  action:
                    "social_onboarding_completed",
                  entityType:
                    "SocialOnboarding",
                  entityId:
                    record.id,
                  metadata: {
                    persona,
                    teamMode,
                    goals,
                  },
                },
              },
            );
          }

          return record;
        },
      );

    revalidatePath(
      "/dashboard/social",
    );

    return jsonResponse(
      {
        ok: true,
        onboarding:
          serializeOnboarding(
            onboarding,
          ),
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-onboarding-update",
      error,
      "Social onboarding could not be updated.",
    );
  }
}