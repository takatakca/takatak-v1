import type {
  ClientCreateInput,
  ClientUpdateInput,
} from "@/lib/clients/client-validation";
import { isPrismaKnownRequestError } from "@/lib/db/prisma-errors";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

function prismaTargetText(error: {
  meta?: { target?: unknown };
}): string {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target
      .map(String)
      .join(" ")
      .toLowerCase();
  }

  return typeof target === "string"
    ? target.toLowerCase()
    : "";
}

function handleClientWriteError(
  error: unknown,
): never {
  if (isPrismaKnownRequestError(error) && error.code === "P2002") {
    const target = prismaTargetText(error);

    if (target.includes("email")) {
      throw new ServiceError(
        "conflict",
        "A workspace with this email already exists.",
        {
          fieldErrors: {
            email:
              "This workspace email is already in use.",
          },
        },
      );
    }

    throw new ServiceError(
      "conflict",
      "A workspace with this name already exists.",
      {
        fieldErrors: {
          name:
            "Workspace names must be unique.",
        },
      },
    );
  }

  throw error;
}

async function resolveAssignedAdminId(
  email: string | null,
): Promise<string | null> {
  if (!email) {
    return null;
  }

  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The workspace service is unavailable.",
    );
  }

  const profile = await prisma.profile.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
      status: "active",
      role: {
        in: ["owner", "admin"],
      },
    },
    select: {
      id: true,
    },
  });

  if (!profile) {
    throw new ServiceError(
      "invalid_input",
      "The assigned administrator must be an active Platform Owner or Platform Admin.",
      {
        fieldErrors: {
          assignedAdminEmail:
            "No active Platform Owner or Platform Admin was found with this email.",
        },
      },
    );
  }

  return profile.id;
}

export async function createClient(
  input: ClientCreateInput,
  actorProfileId: string,
) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The workspace service is unavailable.",
    );
  }

  const [
    existingName,
    existingEmail,
    ownerProfile,
    assignedProfileId,
  ] = await Promise.all([
    prisma.client.findFirst({
      where: {
        name: {
          equals: input.name,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    }),

    input.email
      ? prisma.client.findFirst({
          where: {
            email: {
              equals: input.email,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve(null),

    prisma.profile.findFirst({
      where: {
        email: {
          equals: input.ownerEmail,
          mode: "insensitive",
        },
        status: "active",
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    }),

    resolveAssignedAdminId(
      input.assignedAdminEmail,
    ),
  ]);

  if (existingName) {
    throw new ServiceError(
      "conflict",
      "A workspace with this name already exists.",
      {
        fieldErrors: {
          name:
            "Workspace names must be unique.",
        },
      },
    );
  }

  if (existingEmail) {
    throw new ServiceError(
      "conflict",
      "A workspace with this email already exists.",
      {
        fieldErrors: {
          email:
            "This workspace email is already in use.",
        },
      },
    );
  }

  if (!ownerProfile) {
    throw new ServiceError(
      "invalid_input",
      "The initial owner must already have an active TAKATAK account.",
      {
        fieldErrors: {
          ownerEmail:
            "No active account was found with this email. Ask the owner to register or accept an invitation first.",
        },
      },
    );
  }

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const client =
          await transaction.client.create({
            data: {
              name: input.name,
              companyName: input.companyName,
              email: input.email,
              phone: input.phone,
              planName: input.planName,
              timezone: input.timezone,
              status: input.status,
              assignedProfileId,
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
          });

        await transaction.clientMembership.create({
          data: {
            clientId: client.id,
            profileId: ownerProfile.id,
            role: "owner",
            status: "active",
          },
        });

        await transaction.auditLog.create({
          data: {
            profileId: actorProfileId,
            clientId: client.id,
            action: "workspace_created",
            entityType: "Client",
            entityId: client.id,
            metadata: {
              note: `${client.name} was created and ${
                ownerProfile.displayName ??
                ownerProfile.email
              } was assigned as the initial workspace owner.`,
              ownerProfileId: ownerProfile.id,
            },
          },
        });

        return client;
      },
    );
  } catch (error) {
    return handleClientWriteError(error);
  }
}

export async function updateClient(
  clientId: string,
  input: ClientUpdateInput,
  actorProfileId: string,
) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The workspace service is unavailable.",
    );
  }

  const current = await prisma.client.findUnique({
    where: {
      id: clientId,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!current) {
    throw new ServiceError(
      "not_found",
      "The selected workspace could not be found.",
    );
  }

  const [
    existingName,
    existingEmail,
    assignedProfileId,
  ] = await Promise.all([
    prisma.client.findFirst({
      where: {
        id: {
          not: clientId,
        },
        name: {
          equals: input.name,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    }),

    input.email
      ? prisma.client.findFirst({
          where: {
            id: {
              not: clientId,
            },
            email: {
              equals: input.email,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve(null),

    resolveAssignedAdminId(
      input.assignedAdminEmail,
    ),
  ]);

  if (existingName) {
    throw new ServiceError(
      "conflict",
      "A workspace with this name already exists.",
      {
        fieldErrors: {
          name:
            "Workspace names must be unique.",
        },
      },
    );
  }

  if (existingEmail) {
    throw new ServiceError(
      "conflict",
      "A workspace with this email already exists.",
      {
        fieldErrors: {
          email:
            "This workspace email is already in use.",
        },
      },
    );
  }

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const client =
          await transaction.client.update({
            where: {
              id: clientId,
            },
            data: {
              name: input.name,
              companyName: input.companyName,
              email: input.email,
              phone: input.phone,
              planName: input.planName,
              timezone: input.timezone,
              status: input.status,
              assignedProfileId,
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
          });

        await transaction.auditLog.create({
          data: {
            profileId: actorProfileId,
            clientId,
            action: "workspace_updated",
            entityType: "Client",
            entityId: clientId,
            metadata: {
              note: `${client.name} was updated.`,
              previousStatus: current.status,
              newStatus: client.status,
            },
          },
        });

        return client;
      },
    );
  } catch (error) {
    return handleClientWriteError(error);
  }
}