export const DEPARTURE_NOTIFY_WINDOW_MINUTES = 10;
export const DEPARTURE_RECHECK_INTERVAL_MINUTES = 15;

export type SmartDepartureDecision =
  | {
      action: "defer";
      leaveAt: Date;
      nextCheckAt: Date;
      trafficDelayMinutes: number;
    }
  | {
      action: "notify";
      leaveAt: Date;
      leaveNow: boolean;
      trafficDelayMinutes: number;
    };

export function decideSmartDeparture(input: {
  startsAt: Date;
  arrivalBufferMinutes: number;
  durationSeconds: number;
  staticDurationSeconds: number;
  now?: Date;
}): SmartDepartureDecision {
  const now = input.now ?? new Date();
  const bufferMs = Math.max(0, input.arrivalBufferMinutes) * 60_000;
  const durationMs = Math.max(0, input.durationSeconds) * 1000;
  const leaveAt = new Date(input.startsAt.getTime() - bufferMs - durationMs);
  const trafficDelayMinutes = Math.max(
    0,
    Math.round(
      (input.durationSeconds - Math.max(0, input.staticDurationSeconds)) / 60,
    ),
  );

  const notifyWindowMs = DEPARTURE_NOTIFY_WINDOW_MINUTES * 60_000;

  if (leaveAt.getTime() > now.getTime() + notifyWindowMs) {
    const regularCheck = now.getTime() + DEPARTURE_RECHECK_INTERVAL_MINUTES * 60_000;
    const finalWindowCheck = leaveAt.getTime() - notifyWindowMs;
    const next = Math.max(
      now.getTime() + 60_000,
      Math.min(regularCheck, finalWindowCheck),
    );

    return {
      action: "defer",
      leaveAt,
      nextCheckAt: new Date(next),
      trafficDelayMinutes,
    };
  }

  return {
    action: "notify",
    leaveAt,
    leaveNow: leaveAt.getTime() <= now.getTime(),
    trafficDelayMinutes,
  };
}
