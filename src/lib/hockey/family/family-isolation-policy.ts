export type HockeyMemberTeamScope = {
  memberId: string;
  exactTeamIds: string[];
};

export function exactTeamEventProjection<
  TEvent extends { teamId: string },
>(
  members: HockeyMemberTeamScope[],
  events: TEvent[],
): Map<string, TEvent[]> {
  const result = new Map<string, TEvent[]>();

  for (const member of members) {
    const exactIds = new Set(member.exactTeamIds);
    result.set(
      member.memberId,
      events.filter((event) => exactIds.has(event.teamId)),
    );
  }

  return result;
}

export function canUseSelectionType(input: {
  memberType: string;
  selectionType: string;
}): boolean {
  if (input.selectionType === "favorite") return true;
  return input.selectionType === "assigned" && input.memberType === "child";
}
