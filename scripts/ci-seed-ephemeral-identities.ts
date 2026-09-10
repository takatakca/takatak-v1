// Create synthetic Auth users + Prisma profiles for ephemeral local Supabase.
import { writeFileSync } from "node:fs";

import { getSupabaseAdminClient } from "../src/lib/auth/supabase-admin";
import { getPrisma } from "../src/lib/db/prisma";

const FORBIDDEN = "pcjfahhlozsseqqevimi";
const SEED_PATH =
  process.env.EPHEMERAL_SEED_PATH?.trim() || "/tmp/takatak-ephemeral-seed.json";

const PASSWORD = "Ephemeral#A1aaaa";

type SeedPerson = {
  email: string;
  password: string;
  authUserId: string;
  profileId: string;
  clientId?: string;
  brandId?: string;
  locationId?: string;
  socialAccountId?: string;
  assignmentId?: string;
};

function forbidHosted(): void {
  const haystack = JSON.stringify(process.env);
  if (haystack.includes(FORBIDDEN) || /supabase\.co/i.test(haystack)) {
    throw new Error("hosted Supabase configuration is not allowed in ephemeral seed");
  }
}

async function createAuthUser(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  email: string,
  password: string,
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user?.id) {
    throw new Error(
      `createUser ${email} failed: ${created.error?.message ?? "no user id"}`,
    );
  }
  return created.data.user.id;
}

async function main() {
  forbidHosted();
  const admin = getSupabaseAdminClient();
  const prisma = getPrisma();
  if (!admin || !prisma) {
    throw new Error("ephemeral seed requires local Supabase admin + DATABASE_URL");
  }

  const authA = await createAuthUser(admin, "account-a@example.test", PASSWORD);
  const authB = await createAuthUser(admin, "account-b@example.test", PASSWORD);
  const authC = await createAuthUser(admin, "account-c@example.test", PASSWORD);
  const authDisabled = await createAuthUser(
    admin,
    "account-disabled@example.test",
    PASSWORD,
  );

  const profileA = await prisma.profile.create({
    data: {
      authUserId: authA,
      email: "account-a@example.test",
      displayName: "Account A",
      firstName: "Ada",
      lastName: "Alpha",
      role: "user",
      status: "active",
    },
  });
  const profileB = await prisma.profile.create({
    data: {
      authUserId: authB,
      email: "account-b@example.test",
      displayName: "Account B",
      firstName: "Bea",
      lastName: "Bravo",
      role: "user",
      status: "active",
    },
  });
  const profileC = await prisma.profile.create({
    data: {
      authUserId: authC,
      email: "account-c@example.test",
      displayName: "Account C",
      firstName: "Cara",
      lastName: "Charlie",
      role: "user",
      status: "active",
    },
  });
  const profileDisabled = await prisma.profile.create({
    data: {
      authUserId: authDisabled,
      email: "account-disabled@example.test",
      displayName: "Account Disabled",
      firstName: "Dee",
      lastName: "Disabled",
      role: "user",
      status: "disabled",
    },
  });

  const workspaceA = await prisma.client.create({
    data: { name: "Workspace A", status: "active" },
  });
  const workspaceB = await prisma.client.create({
    data: { name: "Workspace B", status: "active" },
  });
  const workspaceDisabled = await prisma.client.create({
    data: { name: "Workspace Disabled", status: "active" },
  });

  await prisma.clientMembership.create({
    data: {
      profileId: profileA.id,
      clientId: workspaceA.id,
      role: "owner",
      status: "active",
    },
  });
  await prisma.clientMembership.create({
    data: {
      profileId: profileB.id,
      clientId: workspaceB.id,
      role: "owner",
      status: "active",
    },
  });
  await prisma.clientMembership.create({
    data: {
      profileId: profileDisabled.id,
      clientId: workspaceDisabled.id,
      role: "owner",
      status: "active",
    },
  });

  const brandA = await prisma.businessBrand.create({
    data: { clientId: workspaceA.id, name: "Brand A", status: "active" },
  });
  const brandB = await prisma.businessBrand.create({
    data: { clientId: workspaceB.id, name: "Brand B", status: "active" },
  });

  const locationA = await prisma.businessLocation.create({
    data: {
      clientId: workspaceA.id,
      businessBrandId: brandA.id,
      name: "Location A",
      addressLine1: "1 A Street",
      city: "Toronto",
      status: "active",
    },
  });
  const locationB = await prisma.businessLocation.create({
    data: {
      clientId: workspaceB.id,
      businessBrandId: brandB.id,
      name: "Location B",
      addressLine1: "1 B Street",
      city: "Toronto",
      status: "active",
    },
  });

  const accountA = await prisma.socialAccount.create({
    data: {
      clientId: workspaceA.id,
      businessBrandId: brandA.id,
      platform: "facebook",
      displayName: "Page A",
    },
  });
  const accountB = await prisma.socialAccount.create({
    data: {
      clientId: workspaceB.id,
      businessBrandId: brandB.id,
      platform: "facebook",
      displayName: "Page B",
    },
  });

  const assignmentA = await prisma.socialBrandAccountAssignment.create({
    data: {
      clientId: workspaceA.id,
      businessBrandId: brandA.id,
      socialAccountId: accountA.id,
      status: "active",
    },
  });
  const assignmentB = await prisma.socialBrandAccountAssignment.create({
    data: {
      clientId: workspaceB.id,
      businessBrandId: brandB.id,
      socialAccountId: accountB.id,
      status: "active",
    },
  });

  const seed = {
    a: {
      email: "account-a@example.test",
      password: PASSWORD,
      authUserId: authA,
      profileId: profileA.id,
      clientId: workspaceA.id,
      brandId: brandA.id,
      locationId: locationA.id,
      socialAccountId: accountA.id,
      assignmentId: assignmentA.id,
    } satisfies SeedPerson,
    b: {
      email: "account-b@example.test",
      password: PASSWORD,
      authUserId: authB,
      profileId: profileB.id,
      clientId: workspaceB.id,
      brandId: brandB.id,
      locationId: locationB.id,
      socialAccountId: accountB.id,
      assignmentId: assignmentB.id,
    } satisfies SeedPerson,
    c: {
      email: "account-c@example.test",
      password: PASSWORD,
      authUserId: authC,
      profileId: profileC.id,
    } satisfies SeedPerson,
    disabled: {
      email: "account-disabled@example.test",
      password: PASSWORD,
      authUserId: authDisabled,
      profileId: profileDisabled.id,
      clientId: workspaceDisabled.id,
    } satisfies SeedPerson,
  };

  writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2), { mode: 0o600 });
  console.log(`[ephemeral-seed] wrote ${SEED_PATH}`);
  console.log(
    "[ephemeral-seed] account-a Workspace A, account-b Workspace B, account-c none, disabled profile",
  );
}

main().catch((error) => {
  console.error("[ephemeral-seed]", error instanceof Error ? error.message : error);
  process.exit(1);
});
