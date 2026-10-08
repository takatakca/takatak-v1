import type { User } from "@supabase/supabase-js";
import { resolveSupabaseProfileIdentity } from "../src/lib/auth/profile-sync";

let failed = 0;

function assert(name: string, ok: boolean) {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}`);
}

function user(partial: Partial<User> & { phone?: string | null }): User {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-08T00:00:00.000Z",
    ...partial,
  } as User;
}

function main() {
  console.log("[auth-phone-identity] verified phone is enough");

  const phoneOnly = resolveSupabaseProfileIdentity(
    user({
      phone: "+15145550123",
      phone_confirmed_at: "2026-10-08T00:01:00.000Z",
      user_metadata: {
        first_name: "Mia",
        last_name: "Tremblay",
        phone: "+15145550123",
        takatak_terms_accepted_at: "2026-10-08T00:00:00.000Z",
        takatak_privacy_accepted_at: "2026-10-08T00:00:00.000Z",
      },
    }),
  );
  assert("phone-only identity is created", phoneOnly !== null);
  assert("phone-only email stays empty", phoneOnly?.email === null);
  assert("phone is verified", phoneOnly?.phoneVerified === true && phoneOnly?.verified === true);
  assert("phone is normalized", phoneOnly?.phone === "+15145550123");
  assert("name comes from registration", phoneOnly?.displayName === "Mia Tremblay");
  assert("consent is kept", phoneOnly?.consent?.termsAcceptedAt === "2026-10-08T00:00:00.000Z");

  const unconfirmed = resolveSupabaseProfileIdentity(
    user({
      phone: "+15145550123",
      user_metadata: { phone: "+15145550123" },
    }),
  );
  assert("unconfirmed phone without email is rejected", unconfirmed === null);

  const junkEmail = resolveSupabaseProfileIdentity(
    user({
      phone: "5145550123",
      phone_confirmed_at: "2026-10-08T00:01:00.000Z",
      user_metadata: { email: "not-an-email", phone: "5145550123" },
    }),
  );
  assert("invalid recovery email is ignored", junkEmail?.email === null && junkEmail?.phone === "+15145550123");

  const emailUser = resolveSupabaseProfileIdentity(
    user({
      email: "Owner@Example.com",
      email_confirmed_at: "2026-10-08T00:01:00.000Z",
    }),
  );
  assert("email login still resolves", emailUser?.email === "owner@example.com" && emailUser?.emailVerified === true);

  const spoofedRecovery = resolveSupabaseProfileIdentity(
    user({
      phone: "+15145550123",
      phone_confirmed_at: "2026-10-08T00:01:00.000Z",
      user_metadata: {
        email: "victim@example.com",
        phone: "+19995550123",
      },
    }),
  );
  assert(
    "registration metadata cannot become a recovery email or phone",
    spoofedRecovery?.email === null &&
      spoofedRecovery?.emailVerified === false &&
      spoofedRecovery?.phone === "+15145550123",
  );

  const unconfirmedEmail = resolveSupabaseProfileIdentity(
    user({
      email: "mia@example.com",
      user_metadata: { email: "mia@example.com" },
    }),
  );
  assert("an unconfirmed auth email is not an identity", unconfirmedEmail === null);

  if (failed > 0) {
    console.error(`[auth-phone-identity] ${failed} failed`);
    process.exit(1);
  }
  console.log("[auth-phone-identity] passed");
}

main();
