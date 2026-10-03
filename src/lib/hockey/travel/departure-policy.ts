export function hockeyLeaveBy(input: {
  startsAt: Date;
  arrivalBufferMinutes: number;
  durationSeconds: number;
}): Date {
  const bufferMs = input.arrivalBufferMinutes * 60_000;
  const travelMs = input.durationSeconds * 1000;
  return new Date(input.startsAt.getTime() - bufferMs - travelMs);
}

export function shouldSendHockeyDepartureAlert(input: {
  now: Date;
  leaveBy: Date;
  alertWindowMinutes?: number;
}): boolean {
  const windowMinutes = input.alertWindowMinutes ?? 10;
  return (
    input.now.getTime() >=
    input.leaveBy.getTime() - windowMinutes * 60_000
  );
}

export function nextHockeyDepartureCheck(input: {
  now: Date;
  leaveBy: Date;
}): Date {
  const fifteenMinutes = new Date(input.now.getTime() + 15 * 60_000);
  const fiveBeforeLeave = new Date(input.leaveBy.getTime() - 5 * 60_000);
  const candidate =
    fiveBeforeLeave.getTime() < fifteenMinutes.getTime()
      ? fiveBeforeLeave
      : fifteenMinutes;

  return candidate.getTime() > input.now.getTime()
    ? candidate
    : new Date(input.now.getTime() + 60_000);
}
