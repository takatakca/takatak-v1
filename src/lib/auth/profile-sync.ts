import type { User } from '@supabase/supabase-js';
import type { Prisma } from '@prisma/client';
import { ensureDefaultSocialSubscription } from '@/lib/billing/social/ensure-default-subscription';
import { getPrisma } from '@/lib/db/prisma';
import {
  normalizeEmail,
  normalizePersonName,
  validateEmail,
  validateFirstName,
  validateLastName,
} from '@/lib/auth/registration-validation';
import { getSessionUser } from '@/lib/auth/supabase-server';
import { normalizePhone } from '@/lib/auth/otp/phone';

export type ProfileSyncOutcome =
  | { outcome: 'existing'; profileId: string }
  | { outcome: 'created'; profileId: string }
  | { outcome: 'updated'; profileId: string }
  | { outcome: 'unavailable' }
  | { outcome: 'denied' }
  | { outcome: 'error' };

export type ProfileSyncOptions = {
  createPersonalWorkspace?: boolean;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function getMetadataName(
  user: User,
  key: 'first_name' | 'last_name',
): string | null {
  const value = user.user_metadata?.[key];

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = normalizePersonName(value);

  const validationError =
    key === 'first_name'
      ? validateFirstName(normalizedValue)
      : validateLastName(normalizedValue);

  return validationError ? null : normalizedValue;
}

export type SupabaseProfileIdentity = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  verified: boolean;
  consent: { termsAcceptedAt: string; privacyAcceptedAt: string } | null;
};

function readOptionalEmail(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const email = normalizeEmail(value);
  return validateEmail(email) ? null : email;
}

function readConsent(user: User): SupabaseProfileIdentity['consent'] {
  const terms =
    typeof user.user_metadata?.takatak_terms_accepted_at === 'string'
      ? user.user_metadata.takatak_terms_accepted_at
      : '';
  const privacy =
    typeof user.user_metadata?.takatak_privacy_accepted_at === 'string'
      ? user.user_metadata.takatak_privacy_accepted_at
      : '';

  if (!terms || !privacy) {
    return null;
  }

  return { termsAcceptedAt: terms, privacyAcceptedAt: privacy };
}

/**
 * A confirmed phone is enough to open an account. The Auth user's own email
 * can create a profile before confirmation so registration can send its code.
 * That address is not a verified recovery email until email_confirmed_at.
 * Client-editable user_metadata is never that proof.
 */
export function resolveSupabaseProfileIdentity(
  user: User,
): SupabaseProfileIdentity | null {
  const authEmail = readOptionalEmail(user.email);
  const email = authEmail;
  const emailVerified = Boolean(email && user.email_confirmed_at);

  const authPhone =
    typeof user.phone === 'string' ? normalizePhone(user.phone) : null;
  const phone =
    authPhone && user.phone_confirmed_at ? authPhone : null;
  const phoneVerified = phone !== null;

  if (!email && !phoneVerified) {
    return null;
  }

  const firstName = getMetadataName(user, 'first_name');
  const lastName = getMetadataName(user, 'last_name');
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  return {
    email,
    phone,
    firstName,
    lastName,
    displayName: fullName || (email ? email.split('@')[0] : null) || phone || 'User',
    emailVerified,
    phoneVerified,
    verified: emailVerified || phoneVerified,
    consent: readConsent(user),
  };
}

type PrismaClientInstance = NonNullable<ReturnType<typeof getPrisma>>;

async function recordTakatakRelationship(
  transaction: Prisma.TransactionClient,
  identityId: string,
  input: {
    authUserId: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    consent: SupabaseProfileIdentity['consent'];
  },
): Promise<boolean> {
  const existing = await transaction.sourceProfile.findUnique({
    where: {
      sourceApplication_externalUserId: {
        sourceApplication: 'takatak',
        externalUserId: input.authUserId,
      },
    },
    select: { id: true, identityId: true },
  });

  if (existing && existing.identityId !== identityId) {
    return false;
  }

  const collectedFields = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    sourceApplication: 'takatak',
  };
  const verifiedFields = [
    ...(input.emailVerified && input.email ? ['email'] : []),
    ...(input.phoneVerified && input.phone ? ['phone'] : []),
  ];
  const data = {
    collectedFields,
    verifiedFields,
    accountStatus: 'active',
    lastSynchronizedAt: new Date(),
    ...(input.consent ? { consentRecords: input.consent } : {}),
  };

  if (existing) {
    await transaction.sourceProfile.update({
      where: { id: existing.id },
      data,
    });
    return true;
  }

  await transaction.sourceProfile.create({
    data: {
      identityId,
      sourceApplication: 'takatak',
      externalUserId: input.authUserId,
      ...data,
    },
  });
  return true;
}

async function ensureMasterIdentityForVerifiedProfile(
  prisma: PrismaClientInstance,
  input: {
    profileId: string;
    authUserId: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    consent: SupabaseProfileIdentity['consent'];
    registeredAt?: Date | null;
  },
): Promise<boolean> {
  if (!input.emailVerified && !input.phoneVerified) {
    return true;
  }

  return prisma.$transaction(async (transaction) => {
    const [currentIdentity, authIdentity, emailIdentity, phoneIdentity] =
      await Promise.all([
        transaction.masterIdentity.findUnique({
          where: { profileId: input.profileId },
        }),
        transaction.masterIdentity.findUnique({
          where: { authUserId: input.authUserId },
        }),
        input.emailVerified && input.email
          ? transaction.masterIdentity.findUnique({
              where: { primaryEmail: input.email },
            })
          : Promise.resolve(null),
        input.phoneVerified && input.phone
          ? transaction.masterIdentity.findUnique({
              where: { primaryPhone: input.phone },
            })
          : Promise.resolve(null),
      ]);

    const candidateIds = new Set(
      [authIdentity, emailIdentity, phoneIdentity]
        .map((identity) => identity?.id ?? null)
        .filter((id): id is string => id !== null),
    );

    if (candidateIds.size > 1) {
      return false;
    }

    for (const identity of [authIdentity, emailIdentity, phoneIdentity]) {
      if (identity?.profileId && identity.profileId !== input.profileId) {
        return false;
      }
      if (
        identity?.authUserId &&
        identity.authUserId !== input.authUserId
      ) {
        return false;
      }
    }

    if (currentIdentity) {
      if (
        (currentIdentity.authUserId &&
          currentIdentity.authUserId !== input.authUserId) ||
        (authIdentity && authIdentity.id !== currentIdentity.id) ||
        (emailIdentity && emailIdentity.id !== currentIdentity.id) ||
        (phoneIdentity && phoneIdentity.id !== currentIdentity.id)
      ) {
        return false;
      }

      await transaction.masterIdentity.update({
        where: { id: currentIdentity.id },
        data: {
          authUserId: currentIdentity.authUserId ?? input.authUserId,
          primaryEmail:
            input.emailVerified && input.email
              ? input.email
              : currentIdentity.primaryEmail,
          primaryEmailVerified:
            currentIdentity.primaryEmailVerified || input.emailVerified,
          primaryPhone:
            input.phoneVerified && input.phone
              ? input.phone
              : currentIdentity.primaryPhone,
          primaryPhoneVerified:
            currentIdentity.primaryPhoneVerified || input.phoneVerified,
          firstName: currentIdentity.firstName ?? input.firstName,
          lastName: currentIdentity.lastName ?? input.lastName,
          registeredAt:
            currentIdentity.registeredAt ?? input.registeredAt ?? undefined,
          accountStatus: currentIdentity.accountStatus ?? 'active',
        },
      });

      return recordTakatakRelationship(transaction, currentIdentity.id, input);
    }

    const candidateIdentity = authIdentity ?? phoneIdentity ?? emailIdentity;

    if (candidateIdentity) {
      await transaction.masterIdentity.update({
        where: { id: candidateIdentity.id },
        data: {
          profileId: input.profileId,
          authUserId: candidateIdentity.authUserId ?? input.authUserId,
          primaryEmail:
            input.emailVerified && input.email
              ? input.email
              : candidateIdentity.primaryEmail,
          primaryEmailVerified:
            candidateIdentity.primaryEmailVerified || input.emailVerified,
          primaryPhone:
            input.phoneVerified && input.phone
              ? input.phone
              : candidateIdentity.primaryPhone,
          primaryPhoneVerified:
            candidateIdentity.primaryPhoneVerified || input.phoneVerified,
          firstName: candidateIdentity.firstName ?? input.firstName,
          lastName: candidateIdentity.lastName ?? input.lastName,
          registeredAt:
            candidateIdentity.registeredAt ?? input.registeredAt ?? undefined,
          accountStatus: candidateIdentity.accountStatus ?? 'active',
        },
      });

      return recordTakatakRelationship(
        transaction,
        candidateIdentity.id,
        input,
      );
    }

    const createdIdentity = await transaction.masterIdentity.create({
      data: {
        profileId: input.profileId,
        authUserId: input.authUserId,
        primaryEmail: input.emailVerified && input.email ? input.email : null,
        primaryEmailVerified: input.emailVerified,
        primaryPhone:
          input.phoneVerified && input.phone ? input.phone : null,
        primaryPhoneVerified: input.phoneVerified,
        firstName: input.firstName,
        lastName: input.lastName,
        registeredAt: input.registeredAt ?? undefined,
        accountStatus: 'active',
      },
    });

    return recordTakatakRelationship(transaction, createdIdentity.id, input);
  });
}
export async function ensurePersonalClientWorkspace(
  profileId: string,
  email: string | null,
  displayName: string,
): Promise<void> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new Error('Database is unavailable.');
  }

  const existingMembership = await prisma.clientMembership.findFirst({
    where: {
      profileId,
    },
    select: {
      id: true,
      clientId: true,
    },
  });

  if (existingMembership) {
    await ensureDefaultSocialSubscription(prisma, existingMembership.clientId);
    return;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.client.createMany({
      data: [
        {
          id: profileId,
          name: `${displayName}'s Workspace`,
          email,
          companyName: null,
          status: 'active',
          assignedProfileId: profileId,
        },
      ],
      skipDuplicates: true,
    });

    const membershipResult = await transaction.clientMembership.createMany({
      data: [
        {
          profileId,
          clientId: profileId,
          role: 'owner',
        },
      ],
      skipDuplicates: true,
    });

    await ensureDefaultSocialSubscription(transaction, profileId);

    if (membershipResult.count === 1) {
      await transaction.auditLog.create({
        data: {
          profileId,
          clientId: profileId,
          action: 'personal_workspace_created',
          entityType: 'Client',
          entityId: profileId,
          metadata: {
            source: 'verified_registration',
          },
        },
      });
    }
  });
}

export async function ensureProfileForSupabaseUser(
  user: User,
  options: ProfileSyncOptions = {},
): Promise<ProfileSyncOutcome> {
  const shouldCreatePersonalWorkspace =
    options.createPersonalWorkspace !== false;
  const prisma = getPrisma();

  if (!prisma) {
    return { outcome: 'unavailable' };
  }

  const identity = resolveSupabaseProfileIdentity(user);

  if (!identity) {
    return { outcome: 'error' };
  }

  try {
    const existingProfile = await prisma.profile.findUnique({
      where: {
        authUserId: user.id,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        displayName: true,
        status: true,
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    });

    if (existingProfile) {
      const firstName = identity.firstName ?? existingProfile.firstName;

      const lastName = identity.lastName ?? existingProfile.lastName;

      const displayName =
        identity.firstName || identity.lastName
          ? identity.displayName
          : existingProfile.displayName || identity.displayName;

      const status =
        existingProfile.status === 'disabled'
          ? 'disabled'
          : identity.verified
            ? 'active'
            : existingProfile.status;

      const nextEmail = identity.email ?? existingProfile.email;

      const requiresUpdate =
        existingProfile.email !== nextEmail ||
        existingProfile.phone !== identity.phone ||
        existingProfile.firstName !== firstName ||
        existingProfile.lastName !== lastName ||
        existingProfile.displayName !== displayName ||
        existingProfile.status !== status;

      const hasWorkspace = existingProfile._count.memberships > 0;

      if (!requiresUpdate) {
        if (
          shouldCreatePersonalWorkspace &&
          identity.verified &&
          existingProfile.status !== 'disabled' &&
          !hasWorkspace
        ) {
          await ensurePersonalClientWorkspace(
            existingProfile.id,
            identity.email,
            displayName,
          );
        }

        const masterIdentityLinked =
          await ensureMasterIdentityForVerifiedProfile(prisma, {
            profileId: existingProfile.id,
            authUserId: user.id,
            email: nextEmail,
            phone: identity.phone,
            firstName,
            lastName,
            emailVerified: identity.emailVerified,
            phoneVerified: identity.phoneVerified,
            consent: identity.consent,
            registeredAt: user.created_at ? new Date(user.created_at) : null,
          });

        if (!masterIdentityLinked) {
          console.error(
            '[profile-sync] Verified contact conflicts with another master identity',
          );
          return { outcome: 'denied' };
        }

        return {
          outcome: 'existing',
          profileId: existingProfile.id,
        };
      }

      const updatedProfile = await prisma.profile.update({
        where: {
          id: existingProfile.id,
        },
        data: {
          email: nextEmail,
          phone: identity.phone,
          firstName,
          lastName,
          displayName,
          status,
        },
      });

      if (
        shouldCreatePersonalWorkspace &&
        identity.verified &&
        updatedProfile.status !== 'disabled' &&
        !hasWorkspace
      ) {
        await ensurePersonalClientWorkspace(
          updatedProfile.id,
          identity.email,
          displayName,
        );
      }

      const masterIdentityLinked =
        await ensureMasterIdentityForVerifiedProfile(prisma, {
          profileId: updatedProfile.id,
          authUserId: user.id,
          email: nextEmail,
          phone: identity.phone,
          firstName,
          lastName,
          emailVerified: identity.emailVerified,
          phoneVerified: identity.phoneVerified,
          consent: identity.consent,
          registeredAt: user.created_at ? new Date(user.created_at) : null,
        });

      if (!masterIdentityLinked) {
        console.error(
          '[profile-sync] Verified contact conflicts with another master identity',
        );
        return { outcome: 'denied' };
      }

      return {
        outcome: 'updated',
        profileId: updatedProfile.id,
      };
    }

    const createdProfile = await prisma.profile.create({
      data: {
        authUserId: user.id,
        email: identity.email,
        phone: identity.phone,
        firstName: identity.firstName,
        lastName: identity.lastName,
        displayName: identity.displayName,
        role: 'user',
        status: identity.verified ? 'active' : 'invited',
      },
    });

    if (
      shouldCreatePersonalWorkspace &&
      identity.verified &&
      createdProfile.status !== 'disabled'
    ) {
      await ensurePersonalClientWorkspace(
        createdProfile.id,
        identity.email,
        identity.displayName,
      );
    }

    const masterIdentityLinked =
      await ensureMasterIdentityForVerifiedProfile(prisma, {
        profileId: createdProfile.id,
        authUserId: user.id,
        email: identity.email,
        phone: identity.phone,
        firstName: identity.firstName,
        lastName: identity.lastName,
        emailVerified: identity.emailVerified,
        phoneVerified: identity.phoneVerified,
        consent: identity.consent,
        registeredAt: user.created_at ? new Date(user.created_at) : null,
      });

    if (!masterIdentityLinked) {
      console.error(
        '[profile-sync] Verified contact conflicts with another master identity',
      );
      return { outcome: 'denied' };
    }

    return {
      outcome: 'created',
      profileId: createdProfile.id,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      try {
        const concurrentProfile = await prisma.profile.findUnique({
          where: {
            authUserId: user.id,
          },
          select: {
            id: true,
            authUserId: true,
          },
        });

        if (concurrentProfile) {
          return {
            outcome: 'existing',
            profileId: concurrentProfile.id,
          };
        }

        const [emailCollision, phoneCollision] = await Promise.all([
          identity.email
            ? prisma.profile.findUnique({
                where: {
                  email: identity.email,
                },
                select: {
                  id: true,
                  authUserId: true,
                },
              })
            : Promise.resolve(null),
          identity.phone
            ? prisma.profile.findUnique({
                where: {
                  phone: identity.phone,
                },
                select: {
                  id: true,
                  authUserId: true,
                },
              })
            : Promise.resolve(null),
        ]);

        if (emailCollision && emailCollision.authUserId !== user.id) {
          console.error(
            '[profile-sync] Email is already bound to a different auth user',
          );
          return { outcome: 'denied' };
        }

        if (phoneCollision && phoneCollision.authUserId !== user.id) {
          console.error(
            '[profile-sync] Phone is already bound to a different auth user',
          );
          return { outcome: 'denied' };
        }
      } catch {
        return { outcome: 'error' };
      }
    }

    console.error(
      '[profile-sync] Profile synchronization failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return { outcome: 'error' };
  }
}

export async function ensureProfileForAuthenticatedUser(): Promise<ProfileSyncOutcome> {
  const user = await getSessionUser();

  if (!user) {
    return { outcome: 'denied' };
  }

  return ensureProfileForSupabaseUser(user);
}
