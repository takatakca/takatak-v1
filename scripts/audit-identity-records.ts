/**
 * Read-only identity audit. Does not delete or repair records.
 *
 * Reports profiles, auth-user links, memberships, and personal workspaces
 * so a human can decide whether a controlled repair is required.
 */
import { disconnectPrisma, getPrisma } from "../src/lib/db/prisma";

type Finding = {
  id: string;
  relationship: string;
  expected: string;
  proposedRepair: string;
  requiresMigration: boolean;
};

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error(
      "[identity-audit] Prisma is not available. DATABASE_URL is required. No records were changed.",
    );
    process.exitCode = 1;
    return;
  }

  const findings: Finding[] = [];

  const profiles = await prisma.profile.findMany({
    select: {
      id: true,
      authUserId: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
      role: true,
      status: true,
      memberships: {
        select: {
          id: true,
          clientId: true,
          role: true,
          status: true,
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              assignedProfileId: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const authUserIds = new Map<string, string[]>();
  const emails = new Map<string, string[]>();

  console.log("[identity-audit] profiles");
  for (const profile of profiles) {
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.displayName ||
      "(no name)";
    console.log(
      `  profile=${profile.id} authUserId=${profile.authUserId} email=${profile.email} name=${JSON.stringify(name)} role=${profile.role} status=${profile.status} memberships=${profile.memberships.length}`,
    );

    const authList = authUserIds.get(profile.authUserId) ?? [];
    authList.push(profile.id);
    authUserIds.set(profile.authUserId, authList);

    const emailKey = profile.email.trim().toLowerCase();
    const emailList = emails.get(emailKey) ?? [];
    emailList.push(profile.id);
    emails.set(emailKey, emailList);

    if (profile.memberships.length === 0) {
      findings.push({
        id: profile.id,
        relationship: "Profile has no workspace membership",
        expected: "A verified user should have a personal workspace or an assigned membership",
        proposedRepair:
          "Do not auto-delete. If the auth user is valid, create a personal workspace for this profile only after confirming the email with the account holder.",
        requiresMigration: false,
      });
    }

    for (const membership of profile.memberships) {
      if (membership.client.id === profile.id) {
        continue;
      }
      if (
        membership.role === "owner" &&
        membership.client.assignedProfileId &&
        membership.client.assignedProfileId !== profile.id
      ) {
        findings.push({
          id: membership.id,
          relationship: `Owner membership ${membership.id} for workspace ${membership.client.id} (${membership.client.name}) is assigned to a different profile ${membership.client.assignedProfileId}`,
          expected: "Workspace assignedProfileId should match the owner membership profile",
          proposedRepair: "Update assignedProfileId to the owner profile after backup, or leave it if a platform admin is intentionally assigned.",
          requiresMigration: true,
        });
      }
    }
  }

  for (const [authUserId, ids] of authUserIds) {
    if (ids.length > 1) {
      findings.push({
        id: authUserId,
        relationship: `Multiple profiles share authUserId ${authUserId}: ${ids.join(", ")}`,
        expected: "One Profile.authUserId per Supabase Auth user",
        proposedRepair: "Keep the profile that matches the live Supabase user email. Relink or disable the duplicate after backup. Do not delete automatically.",
        requiresMigration: true,
      });
    }
  }

  for (const [email, ids] of emails) {
    if (ids.length > 1) {
      findings.push({
        id: email,
        relationship: `Multiple profiles share email ${email}: ${ids.join(", ")}`,
        expected: "One profile per email",
        proposedRepair: "Confirm which auth UUID owns the mailbox. Relink the live UUID; leave the other profile disabled after backup.",
        requiresMigration: true,
      });
    }
  }

  const memberships = await prisma.clientMembership.findMany({
    select: {
      id: true,
      profileId: true,
      clientId: true,
      role: true,
      status: true,
    },
  });
  const profileIdSet = new Set(profiles.map((profile: { id: string }) => profile.id));
  for (const membership of memberships) {
    if (!profileIdSet.has(membership.profileId)) {
      findings.push({
        id: membership.id,
        relationship: `Orphaned membership ${membership.id} points at missing profile ${membership.profileId}`,
        expected: "Every membership belongs to an existing profile",
        proposedRepair: "Backup then delete the orphaned membership, or restore the profile if the auth user still exists.",
        requiresMigration: true,
      });
    }
  }

  console.log("[identity-audit] findings");
  if (findings.length === 0) {
    console.log("  none — no duplicate auth links, shared emails, or orphaned memberships");
  } else {
    for (const finding of findings) {
      console.log(`  ID ${finding.id}`);
      console.log(`    relationship: ${finding.relationship}`);
      console.log(`    expected: ${finding.expected}`);
      console.log(`    proposedRepair: ${finding.proposedRepair}`);
      console.log(`    requiresMigration: ${finding.requiresMigration}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(
      "[identity-audit] failed",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
