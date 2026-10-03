import type { HockeyMembershipFeature } from "./types";

export const HOCKEY_PARENT_PREFERENCE_FEATURES = {
  smsReminders: "game_reminders",
  calendarSync: "calendar_sync",
  departureAlerts: "game_reminders",
} as const satisfies Record<
  "smsReminders" | "calendarSync" | "departureAlerts",
  HockeyMembershipFeature
>;

export type HockeyParentPreferenceInput = {
  teamId: string;
  smsReminders: boolean;
  calendarSync: boolean;
  departureAlerts: boolean;
  arrivalBufferMinutes: number;
};

const TEAM_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function booleanField(
  value: unknown,
  fallback = false,
): boolean | null {
  if (value === undefined) return fallback;
  return typeof value === "boolean" ? value : null;
}

export function validateHockeyParentPreferenceInput(value: unknown):
  | { success: true; data: HockeyParentPreferenceInput }
  | { success: false; message: string; fieldErrors: Record<string, string> } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      message: "Choose an exact AHMV team and your reminder preferences.",
      fieldErrors: { teamId: "An exact public team ID is required." },
    };
  }

  const input = value as Record<string, unknown>;
  const teamId =
    typeof input.teamId === "string" ? input.teamId.trim() : "";

  const fieldErrors: Record<string, string> = {};

  if (
    !teamId ||
    teamId.length > 160 ||
    !TEAM_ID_PATTERN.test(teamId)
  ) {
    fieldErrors.teamId =
      "Use the exact public AHMV team ID shown by the team microsite.";
  }

  const smsReminders = booleanField(input.smsReminders);
  const calendarSync = booleanField(input.calendarSync);
  const departureAlerts = booleanField(input.departureAlerts);

  if (smsReminders === null) fieldErrors.smsReminders = "Choose on or off.";
  if (calendarSync === null) fieldErrors.calendarSync = "Choose on or off.";
  if (departureAlerts === null) fieldErrors.departureAlerts = "Choose on or off.";

  const bufferRaw =
    input.arrivalBufferMinutes === undefined ? 30 : input.arrivalBufferMinutes;
  const arrivalBufferMinutes =
    typeof bufferRaw === "number" && Number.isInteger(bufferRaw)
      ? bufferRaw
      : Number.NaN;

  if (
    !Number.isFinite(arrivalBufferMinutes) ||
    arrivalBufferMinutes < 0 ||
    arrivalBufferMinutes > 180
  ) {
    fieldErrors.arrivalBufferMinutes =
      "Arrival buffer must be a whole number from 0 to 180 minutes.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Review the parent reminder preferences.",
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      teamId,
      smsReminders: smsReminders!,
      calendarSync: calendarSync!,
      departureAlerts: departureAlerts!,
      arrivalBufferMinutes,
    },
  };
}

export function enabledPreferenceFeatures(
  input: HockeyParentPreferenceInput,
): HockeyMembershipFeature[] {
  const features = new Set<HockeyMembershipFeature>();

  if (input.smsReminders) {
    features.add(HOCKEY_PARENT_PREFERENCE_FEATURES.smsReminders);
  }
  if (input.calendarSync) {
    features.add(HOCKEY_PARENT_PREFERENCE_FEATURES.calendarSync);
  }
  if (input.departureAlerts) {
    features.add(HOCKEY_PARENT_PREFERENCE_FEATURES.departureAlerts);
  }

  return [...features];
}
