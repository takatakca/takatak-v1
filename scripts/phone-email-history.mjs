import { canonicalSql } from "./production-migration-normalization.mjs";

export const PHONE_EMAIL_MIGRATION = "20261008153000_phone_only_profile_email";
export const PHONE_EMAIL_SUPABASE_NAME = "phone_only_profile_email";
export const STAGING_PROJECT_REF = "utuvzrqvivqyziibobvu";
export const PRODUCTION_PROJECT_REF = "pcjfahhlozsseqqevimi";

export function phoneEmailHistoryDecision(input) {
  if (input.nullable !== true) {
    return {
      action: "refuse",
      reason: "profiles.email is not nullable. Refusing to change the column.",
    };
  }
  if (!input.historySql) {
    return {
      action: "refuse",
      reason: "Supabase history has no phone_only_profile_email entry.",
    };
  }
  if (canonicalSql(input.historySql) !== canonicalSql(input.repoSql)) {
    return {
      action: "refuse",
      reason: "Supabase history SQL does not match the Prisma migration file.",
    };
  }
  if (input.alreadyRecorded) {
    return {
      action: "noop",
      reason: "Prisma history already records this migration.",
    };
  }
  return {
    action: "resolve",
    reason: "Record the migration in Prisma history without running SQL.",
  };
}
