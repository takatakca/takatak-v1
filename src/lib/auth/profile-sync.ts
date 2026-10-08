import type { Prisma } from '@prisma/client';
import type { User } from '@supabase/supabase-js';
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

export function getProfileIdentity(user: User): {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  verified: boolean;
} | null {
  const authEmail =
    typeof user.email === 'string' && user.email.trim()
      ? normalizeEmail(user.email)
      : '';
  // Only provider-confirmed contacts may participate in unique identity binding.
  // user_metadata is client editable and is never proof of contact ownership.
  const email = authEmail && !validateEmail(authEmail) && user.email_confirmed_at
    ? authEmail : null;
  const authPhone =
    typeof user.phone === 'string' ? normalizePhone(user.phone) : null;
  const phone = authPhone && user.phone_confirmed_at ? authPhone : null;
  if (!email && !phone) return null;

  const firstName = getMetadataName(user, 'first_name');
  const lastName = getMetadataName(user, 'last_name');
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const emailVerified = Boolean(email);
  const phoneVerified = Boolean(phone);

  return {
    email,
    phone,
    firstName,
    lastName,
    displayName: fullName || email?.split('@')[0] || 'User',
    emailVerified,
    phoneVerified,
    verified: emailVerified || phoneVerified,
  };
}

type PrismaClientInstance = Prisma.TransactionClient;

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
    registeredAt?: Date | null;
  },
): Promise<boolean> {
  if (!input.emailVerified && !input.phoneVerified) {
    return true;
  }

  const transaction = prisma;
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

  if ([currentIdentity, authIdentity, emailIdentity, phoneIdentity].some(
    (record) => record && record.accountStatus !== null && record.accountStatus !== 'active',
  )) return false;

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
        primaryEmail: input.emailVerified
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

    return true;
  }

  const candidateIdentity = authIdentity ?? phoneIdentity ?? emailIdentity;

  if (candidateIdentity) {
    if (candidateIdentity.authUserId !== input.authUserId) return false;
    await transaction.masterIdentity.update({
      where: { id: candidateIdentity.id },
      data: {
        profileId: input.profileId,
        authUserId: candidateIdentity.authUserId ?? input.authUserId,
        primaryEmail: input.emailVerified
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

    return true;
  }

  await transaction.masterIdentity.create({
    data: {
      profileId: input.profileId,
      authUserId: input.authUserId,
      primaryEmail: input.emailVerified ? input.email : null,
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

  return true;
}
export async function ensurePersonalClientWorkspace(
  profileId: string,
  email: string | null,
  displayName: string,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new Error('Database is unavailable.');
  await prisma.$transaction((transaction) =>
    ensurePersonalWorkspace(transaction, profileId, email, displayName));
}

async function ensurePersonalWorkspace(
  prisma: Prisma.TransactionClient,
  profileId: string,
  email: string | null,
  displayName: string,
): Promise<void> {
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

  const transaction = prisma;
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
}

class IdentityConflict extends Error {}

export async function ensureProfileForSupabaseUser(
  user: User,
  options: ProfileSyncOptions = {},
  dependencies: { getPrisma?: typeof getPrisma } = {},
): Promise<ProfileSyncOutcome> {
  const prisma = (dependencies.getPrisma ?? getPrisma)();
  if (!prisma) return { outcome: 'unavailable' };
  const identity = getProfileIdentity(user);
  if (!identity) return { outcome: 'denied' };

  // Retry only bounded uniqueness/serialization races. Every retry executes all gates.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (transaction): Promise<ProfileSyncOutcome> => {
        const existing = await transaction.profile.findUnique({ where: { authUserId: user.id } });
        if (existing?.status === 'disabled') throw new IdentityConflict();
        const firstName = identity.firstName ?? existing?.firstName ?? null;
        const lastName = identity.lastName ?? existing?.lastName ?? null;
        const displayName = identity.firstName || identity.lastName
          ? identity.displayName : existing?.displayName || identity.displayName;
        const data = {
          email: identity.email, phone: identity.phone, firstName, lastName,
          displayName, status: 'active' as const,
        };
        const changed = existing && Object.entries(data).some(
          ([key, value]) => existing[key as keyof typeof data] !== value,
        );
        const profile = existing
          ? changed ? await transaction.profile.update({ where: { id: existing.id }, data }) : existing
          : await transaction.profile.create({ data: { ...data, authUserId: user.id, role: 'user' } });

        const linked = await ensureMasterIdentityForVerifiedProfile(transaction, {
          profileId: profile.id, authUserId: user.id,
          email: identity.email, phone: identity.phone, firstName, lastName,
          emailVerified: identity.emailVerified, phoneVerified: identity.phoneVerified,
          registeredAt: user.created_at ? new Date(user.created_at) : null,
        });
        if (!linked) throw new IdentityConflict();
        if (options.createPersonalWorkspace !== false) {
          await ensurePersonalWorkspace(transaction, profile.id, identity.email, displayName);
        }
        return { outcome: existing ? changed ? 'updated' : 'existing' : 'created', profileId: profile.id };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof IdentityConflict) return { outcome: 'denied' };
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
      if ((isUniqueConstraintError(error) || code === 'P2034') && attempt < 2) continue;
      // Do not log database error messages: unique-constraint details can contain contacts.
      console.error('[profile-sync] Synchronization failed', { code: code === 'P2002' ? 'contact_conflict' : 'database_error' });
      return { outcome: isUniqueConstraintError(error) ? 'denied' : 'error' };
    }
  }
  return { outcome: 'error' };
}

export async function ensureProfileForAuthenticatedUser(): Promise<ProfileSyncOutcome> {
  const user = await getSessionUser();

  if (!user) {
    return { outcome: 'denied' };
  }

  return ensureProfileForSupabaseUser(user);
}
