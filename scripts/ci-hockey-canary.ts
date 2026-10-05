import assert from "node:assert/strict";

import { disconnectPrisma, getPrisma } from "../src/lib/db/prisma";
import { getHockeyMembershipSnapshot } from "../src/lib/billing/hockey/membership-service";
import { saveHockeyParentTeamPreference } from "../src/lib/billing/hockey/parent-preference-service";
import { applyAhmvTeamEvent, HockeyUnknownPublicTeamError } from "../src/lib/hockey/events/apply-event";
import type { AhmvTeamEventEnvelope } from "../src/lib/hockey/events/types";
import {
  addHockeyFamilyChild,
  addHockeyFamilyTeamSelection,
  ensureDefaultHockeyFamily,
  getHockeyFamilySchedule,
} from "../src/lib/hockey/family/family-service";
import {
  acceptHockeyFamilyGuardianInvite,
  createHockeyFamilyGuardianInvite,
  hashHockeyFamilyInviteTokenForTest,
} from "../src/lib/hockey/family/guardian-invite-service";
import { deactivateHockeyFamilyGuardian } from "../src/lib/hockey/family/guardian-access-service";
import { updateHockeyFamilyChild } from "../src/lib/hockey/family/child-lifecycle-service";
import {
  listHockeyFamilyEventPlans,
  saveHockeyFamilyEventPlan,
} from "../src/lib/hockey/family/game-logistics-service";
import {
  listHockeyFamilyEventRsvps,
  saveHockeyFamilyEventRsvp,
} from "../src/lib/hockey/family/rsvp-service";
import { ServiceError } from "../src/lib/services/service-error";

const prismaCandidate = getPrisma();
if (!prismaCandidate) {
  throw new Error("DATABASE_URL must point to the ephemeral CI database.");
}
const prisma = prismaCandidate;

const authUserA = "00000000-0000-4000-8000-00000000a001";
const authUserB = "00000000-0000-4000-8000-00000000a002";
const teamExact = "ci-ahmv-team-exact";
const teamNear = "ci-ahmv-team-exact-9";
const sourceEventExact = "ci-ahmv-event-exact";
const sourceEventNear = "ci-ahmv-event-near";
const now = new Date("2026-10-03T12:00:00.000Z");

async function cleanup() {
  await prisma.masterIdentity.deleteMany({
    where: { authUserId: { in: [authUserA, authUserB] } },
  });
  await prisma.hockeyTeamEvent.deleteMany({
    where: { sourceEventId: { in: [sourceEventExact, sourceEventNear] } },
  });
  await prisma.hockeyPublicTeam.deleteMany({
    where: { teamId: { in: [teamExact, teamNear] } },
  });
}

async function main() {
  await cleanup();

  const [identityA, identityB] = await Promise.all([
    prisma.masterIdentity.create({
      data: {
        authUserId: authUserA,
        firstName: "Canary",
        lastName: "Parent A",
        accountStatus: "active",
        locale: "fr-CA",
      },
      select: { id: true },
    }),
    prisma.masterIdentity.create({
      data: {
        authUserId: authUserB,
        firstName: "Canary",
        lastName: "Parent B",
        accountStatus: "active",
        locale: "en-CA",
      },
      select: { id: true },
    }),
  ]);

  await prisma.hockeyMembership.create({
    data: {
      identityId: identityA.id,
      sourceApplication: "ahmverdun",
      status: "active",
      planCode: "hockey_member_weekly_10",
      planName: "AHMV Member",
      provider: "stripe",
      externalCustomerId: "cus_ci_ahmv_canary",
      externalSubscriptionId: "sub_ci_ahmv_canary",
      currentPeriodStart: now,
      currentPeriodEnd: new Date("2026-11-03T12:00:00.000Z"),
    },
  });

  await prisma.hockeyPublicTeam.createMany({
    data: [
      {
        sourceApplication: "ahmverdun",
        teamId: teamExact,
        categorySlug: "m9",
        level: "A",
        name: "CI LEAFS VERDUN",
        seasonCode: "2026-2027",
        active: true,
        sourceUpdatedAt: now,
      },
      {
        sourceApplication: "ahmverdun",
        teamId: teamNear,
        categorySlug: "m9",
        level: "B",
        name: "CI NEAR MATCH",
        seasonCode: "2026-2027",
        active: true,
        sourceUpdatedAt: now,
      },
    ],
  });

  const membership = await getHockeyMembershipSnapshot(authUserA);
  assert.equal(membership.access, "paid");
  assert.equal(membership.accessSource, "stripe");
  assert.ok(membership.features.includes("game_reminders"));
  assert.ok(membership.features.includes("calendar_sync"));
  assert.ok(membership.features.includes("smart_departure"));
  assert.ok(membership.features.includes("family_sync"));

  const family = await ensureDefaultHockeyFamily(authUserA);
  const child = await addHockeyFamilyChild({
    authUserId: authUserA,
    familyId: family.familyId,
    displayName: "Enfant canari",
  });

  const selection = await addHockeyFamilyTeamSelection({
    authUserId: authUserA,
    familyId: family.familyId,
    memberId: child.id,
    teamId: teamExact,
    selectionType: "assigned",
  });
  assert.equal(selection.team.teamId, teamExact);

  await saveHockeyParentTeamPreference(authUserA, {
    teamId: teamExact,
    smsReminders: true,
    calendarSync: true,
    departureAlerts: true,
    arrivalBufferMinutes: 30,
  });

  const exactEnvelope: AhmvTeamEventEnvelope = {
    eventId: "ci-envelope-exact",
    type: "hockey.team_event.upsert",
    occurredAt: now,
    event: {
      sourceEventId: sourceEventExact,
      teamId: teamExact,
      eventType: "game",
      title: "CI Verdun vs visiteurs",
      startsAt: new Date("2026-10-10T23:00:00.000Z"),
      endsAt: new Date("2026-10-11T00:30:00.000Z"),
      timezone: "America/Toronto",
      arenaName: "Auditorium de Verdun",
      arenaAddress: "4110 boulevard LaSalle, Montréal, QC",
      arenaLatitude: 45.459,
      arenaLongitude: -73.566,
      status: "confirmed",
      sourceUrl: `https://ahmverdun.com/schedules?teamId=${teamExact}`,
      sourceUpdatedAt: now,
    },
  };

  let unknownTeamRejected = false;
  try {
    await applyAhmvTeamEvent(
      {
        ...exactEnvelope,
        eventId: "ci-envelope-unknown-team",
        event: {
          ...exactEnvelope.event,
          sourceEventId: "ci-ahmv-event-unknown-team",
          teamId: "ci-ahmv-team-unknown",
        },
      },
      now,
    );
  } catch (error) {
    unknownTeamRejected = error instanceof HockeyUnknownPublicTeamError;
  }
  assert.equal(unknownTeamRejected, true);

  const first = await applyAhmvTeamEvent(exactEnvelope, now);
  assert.equal(first.applied, true);
  assert.equal(first.deliveryJobsCreated, 3);

  const duplicate = await applyAhmvTeamEvent(exactEnvelope, now);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.deliveryJobsCreated, 0);

  const changedEnvelope: AhmvTeamEventEnvelope = {
    ...exactEnvelope,
    eventId: "ci-envelope-exact-revision-2",
    occurredAt: new Date(now.getTime() + 60_000),
    event: {
      ...exactEnvelope.event,
      title: "CI Verdun vs visiteurs — heure modifiée",
      startsAt: new Date("2026-10-10T23:30:00.000Z"),
      endsAt: new Date("2026-10-11T01:00:00.000Z"),
      sourceUpdatedAt: new Date(now.getTime() + 60_000),
    },
  };

  const changed = await applyAhmvTeamEvent(changedEnvelope, now);
  assert.equal(changed.applied, true);
  assert.equal(changed.deliveryJobsCreated, 4);

  const stale = await applyAhmvTeamEvent(
    {
      ...exactEnvelope,
      eventId: "ci-envelope-stale",
      event: {
        ...exactEnvelope.event,
        title: "CI stale payload",
        sourceUpdatedAt: new Date(now.getTime() - 60_000),
      },
    },
    now,
  );
  assert.equal(stale.applied, false);
  assert.equal(stale.stale, true);

  await applyAhmvTeamEvent(
    {
      eventId: "ci-envelope-near",
      type: "hockey.team_event.upsert",
      occurredAt: now,
      event: {
        sourceEventId: sourceEventNear,
        teamId: teamNear,
        eventType: "game",
        title: "CI near-match team event",
        startsAt: new Date("2026-10-11T18:00:00.000Z"),
        endsAt: new Date("2026-10-11T19:30:00.000Z"),
        timezone: "America/Toronto",
        arenaName: "Aréna test",
        arenaAddress: "Montréal, QC",
        arenaLatitude: null,
        arenaLongitude: null,
        status: "confirmed",
        sourceUrl: `https://ahmverdun.com/schedules?teamId=${teamNear}`,
        sourceUpdatedAt: now,
      },
    },
    now,
  );

  const schedule = await getHockeyFamilySchedule({
    authUserId: authUserA,
    familyId: family.familyId,
    from: new Date("2026-10-09T00:00:00.000Z"),
    to: new Date("2026-10-12T23:59:59.000Z"),
  });

  const childProjection = schedule.members.find(
    (member) => member.id === child.id,
  );
  assert.ok(childProjection);
  assert.deepEqual(
    childProjection.teams.map((team) => team.teamId),
    [teamExact],
  );
  assert.deepEqual(
    childProjection.events.map((event) => event.teamId),
    [teamExact],
  );
  assert.equal(
    childProjection.events.some((event) => event.teamId === teamNear),
    false,
  );

  let denied = false;
  try {
    await getHockeyFamilySchedule({
      authUserId: authUserB,
      familyId: family.familyId,
      from: new Date("2026-10-09T00:00:00.000Z"),
      to: new Date("2026-10-12T23:59:59.000Z"),
    });
  } catch (error) {
    denied = error instanceof ServiceError && error.code === "forbidden";
  }
  assert.equal(denied, true);

  const guardianInvite = await createHockeyFamilyGuardianInvite({
    authUserId: authUserA,
    familyId: family.familyId,
    now,
  });
  assert.match(guardianInvite.token, /^[A-Za-z0-9_-]{43,128}$/);

  const persistedInvite = await prisma.hockeyFamilyInvite.findUnique({
    where: { id: guardianInvite.invite.id },
    select: { tokenHash: true, status: true },
  });
  assert.ok(persistedInvite);
  assert.equal(persistedInvite.status, "pending");
  assert.notEqual(persistedInvite.tokenHash, guardianInvite.token);
  assert.equal(
    persistedInvite.tokenHash,
    hashHockeyFamilyInviteTokenForTest(guardianInvite.token),
  );

  const accepted = await acceptHockeyFamilyGuardianInvite({
    authUserId: authUserB,
    token: guardianInvite.token,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(accepted.familyId, family.familyId);
  assert.equal(accepted.guardian.memberType, "guardian");

  const sharedSchedule = await getHockeyFamilySchedule({
    authUserId: authUserB,
    familyId: family.familyId,
    from: new Date("2026-10-09T00:00:00.000Z"),
    to: new Date("2026-10-12T23:59:59.000Z"),
  });
  assert.equal(sharedSchedule.familyId, family.familyId);
  assert.ok(
    sharedSchedule.members.some((member) => member.id === child.id),
  );

  let replayBlocked = false;
  try {
    await acceptHockeyFamilyGuardianInvite({
      authUserId: authUserB,
      token: guardianInvite.token,
      now: new Date(now.getTime() + 120_000),
    });
  } catch (error) {
    replayBlocked =
      error instanceof ServiceError && error.code === "conflict";
  }
  assert.equal(replayBlocked, true);

  const exactEvent = await prisma.hockeyTeamEvent.findUnique({
    where: {
      sourceApplication_sourceEventId: {
        sourceApplication: "ahmverdun",
        sourceEventId: sourceEventExact,
      },
    },
    select: { id: true },
  });
  assert.ok(exactEvent);

  const responsibility = await saveHockeyFamilyEventPlan({
    authUserId: authUserA,
    familyId: family.familyId,
    teamEventId: exactEvent.id,
    childMemberId: child.id,
    driverMemberId: accepted.guardian.id,
    status: "confirmed",
  });
  assert.equal(responsibility.child.id, child.id);
  assert.equal(responsibility.driver.id, accepted.guardian.id);
  assert.equal(responsibility.status, "confirmed");

  const sharedLogistics = await listHockeyFamilyEventPlans({
    authUserId: authUserB,
    familyId: family.familyId,
    teamEventId: exactEvent.id,
  });
  assert.equal(sharedLogistics.plans.length, 1);
  assert.equal(sharedLogistics.plans[0]?.child.id, child.id);
  assert.equal(sharedLogistics.plans[0]?.driver.id, accepted.guardian.id);

  const sharedScheduleAfterPlan = await getHockeyFamilySchedule({
    authUserId: authUserB,
    familyId: family.familyId,
    from: new Date("2026-10-09T00:00:00.000Z"),
    to: new Date("2026-10-12T23:59:59.000Z"),
  });
  assert.equal(sharedScheduleAfterPlan.responsibilities.length, 1);
  assert.equal(
    sharedScheduleAfterPlan.responsibilities[0]?.teamEventId,
    exactEvent.id,
  );
  assert.equal(
    sharedScheduleAfterPlan.responsibilities[0]?.driver.id,
    accepted.guardian.id,
  );

  const familyRsvp = await saveHockeyFamilyEventRsvp({
    authUserId: authUserB,
    familyId: family.familyId,
    teamEventId: exactEvent.id,
    childMemberId: child.id,
    status: "going",
  });
  assert.equal(familyRsvp.status, "going");
  assert.equal(familyRsvp.child.id, child.id);

  const sharedRsvp = await listHockeyFamilyEventRsvps({
    authUserId: authUserA,
    familyId: family.familyId,
    teamEventId: exactEvent.id,
  });
  assert.equal(sharedRsvp.rsvps.length, 1);
  assert.equal(sharedRsvp.rsvps[0]?.child.id, child.id);
  assert.equal(sharedRsvp.rsvps[0]?.status, "going");

  const inviteCreatedBySecondGuardian =
    await createHockeyFamilyGuardianInvite({
      authUserId: authUserB,
      familyId: family.familyId,
      now: new Date(now.getTime() + 180_000),
    });

  let ownerRemovalBlocked = false;
  try {
    await deactivateHockeyFamilyGuardian({
      authUserId: authUserA,
      familyId: family.familyId,
      guardianMemberId: family.guardian.id,
    });
  } catch (error) {
    ownerRemovalBlocked =
      error instanceof ServiceError && error.code === "conflict";
  }
  assert.equal(ownerRemovalBlocked, true);

  const removedGuardian = await deactivateHockeyFamilyGuardian({
    authUserId: authUserA,
    familyId: family.familyId,
    guardianMemberId: accepted.guardian.id,
  });
  assert.equal(removedGuardian.guardianMemberId, accepted.guardian.id);
  assert.equal(removedGuardian.leftVoluntarily, false);
  assert.equal(removedGuardian.cancelledFutureDrivingPlans, 1);
  assert.equal(removedGuardian.revokedPendingInvites, 1);

  const revokedInvite = await prisma.hockeyFamilyInvite.findUnique({
    where: { id: inviteCreatedBySecondGuardian.invite.id },
    select: { status: true },
  });
  assert.equal(revokedInvite?.status, "revoked");

  const cancelledPlan = await prisma.hockeyFamilyEventPlan.findUnique({
    where: {
      familyId_teamEventId_childMemberId: {
        familyId: family.familyId,
        teamEventId: exactEvent.id,
        childMemberId: child.id,
      },
    },
    select: { status: true },
  });
  assert.equal(cancelledPlan?.status, "cancelled");

  let removedGuardianDenied = false;
  try {
    await getHockeyFamilySchedule({
      authUserId: authUserB,
      familyId: family.familyId,
      from: new Date("2026-10-09T00:00:00.000Z"),
      to: new Date("2026-10-12T23:59:59.000Z"),
    });
  } catch (error) {
    removedGuardianDenied =
      error instanceof ServiceError && error.code === "forbidden";
  }
  assert.equal(removedGuardianDenied, true);

  const lifecycleChild = await addHockeyFamilyChild({
    authUserId: authUserA,
    familyId: family.familyId,
    displayName: "Enfant cycle",
  });
  await addHockeyFamilyTeamSelection({
    authUserId: authUserA,
    familyId: family.familyId,
    memberId: lifecycleChild.id,
    teamId: teamExact,
    selectionType: "assigned",
  });
  await saveHockeyFamilyEventPlan({
    authUserId: authUserA,
    familyId: family.familyId,
    teamEventId: exactEvent.id,
    childMemberId: lifecycleChild.id,
    driverMemberId: family.guardian.id,
    status: "confirmed",
  });
  await saveHockeyFamilyEventRsvp({
    authUserId: authUserA,
    familyId: family.familyId,
    teamEventId: exactEvent.id,
    childMemberId: lifecycleChild.id,
    status: "going",
  });

  const renamedChild = await updateHockeyFamilyChild({
    authUserId: authUserA,
    familyId: family.familyId,
    childMemberId: lifecycleChild.id,
    displayName: "Enfant cycle modifié",
  });
  assert.equal(renamedChild.child.displayName, "Enfant cycle modifié");
  assert.equal(renamedChild.child.status, "active");

  const deactivatedChild = await updateHockeyFamilyChild({
    authUserId: authUserA,
    familyId: family.familyId,
    childMemberId: lifecycleChild.id,
    status: "inactive",
  });
  assert.equal(deactivatedChild.child.status, "inactive");
  assert.equal(deactivatedChild.cancelledFutureDrivingPlans, 1);
  assert.equal(deactivatedChild.removedFutureRsvps, 1);

  const ownerScheduleAfterChildDeactivation =
    await getHockeyFamilySchedule({
      authUserId: authUserA,
      familyId: family.familyId,
      from: new Date("2026-10-09T00:00:00.000Z"),
      to: new Date("2026-10-12T23:59:59.000Z"),
    });
  assert.equal(
    ownerScheduleAfterChildDeactivation.members.some(
      (member) => member.id === lifecycleChild.id,
    ),
    false,
  );

  const jobs = await prisma.hockeyDeliveryJob.findMany({
    where: { identityId: identityA.id },
    select: { kind: true, status: true },
  });
  assert.ok(jobs.some((job) => job.kind === "calendar_sync"));
  assert.ok(jobs.some((job) => job.kind === "sms_reminder"));
  assert.ok(jobs.some((job) => job.kind === "sms_event_change"));
  assert.ok(jobs.some((job) => job.kind === "departure_alert"));
  assert.ok(jobs.some((job) => job.status === "skipped"));

  console.log(
    "ci-hockey-canary: membership, exact-team family isolation, guardian invite replay protection, shared driving responsibility, private family RSVP, guardian access revocation, child lifecycle cleanup, event revisions and delivery queue passed",
  );
}

async function runCanary() {
  try {
    await main();
  } finally {
    try {
      await cleanup();
    } finally {
      await disconnectPrisma();
    }
  }
}

void runCanary().catch((error) => {
  console.error(
    "ci-hockey-canary failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
