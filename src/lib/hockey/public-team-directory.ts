export type AhmvPublicTeamSeed = {
  categorySlug: string;
  level: string;
  name: string;
  teamId: string;
};

export const AHMV_PUBLIC_TEAM_SOURCE = {
  sourceApplication: "ahmverdun",
  seasonCode: "2026-2027",
  canonicalDomain: "https://ahmverdun.ca",
  legacyScheduleOrigin: "https://ahmverdun.com",
} as const;

/**
 * Public AHM Verdun / GameData directory mirrored from the AHMV web source.
 * Public metadata only: no roster, birth date, contact or other personal data.
 * Keep duplicate display names when they have distinct public team IDs.
 */
export const AHMV_PUBLIC_TEAMS: readonly AhmvPublicTeamSeed[] = [
  { categorySlug: "m7", level: "Récréatif", name: "DUCKS M7-0 VERDUN", teamId: "2025191400017305" },
  { categorySlug: "m7", level: "Récréatif", name: "FLAMES M7-2 VERDUN", teamId: "2025191400017103" },
  { categorySlug: "m7", level: "Récréatif", name: "JETS M7-2 VERDUN", teamId: "2025191400017099" },
  { categorySlug: "m7", level: "Récréatif", name: "OILERS M7-1 VERDUN", teamId: "2025191400016760" },

  { categorySlug: "m9", level: "Hockey sur mesure", name: "Hockey sur mesure 2015-2018", teamId: "2025191400041974" },
  { categorySlug: "m9", level: "A", name: "LEAFS VERDUN", teamId: "2025191400017862" },
  { categorySlug: "m9", level: "B", name: "BULLDOGS VERDUN", teamId: "2025191400017621" },
  { categorySlug: "m9", level: "C", name: "COYOTES VERDUN", teamId: "2025191400018212" },
  { categorySlug: "m9", level: "D", name: "DYNAMOS VERDUN", teamId: "2025191400018509" },

  { categorySlug: "m11", level: "A", name: "LEAFS VERDUN", teamId: "2025191400018816" },
  { categorySlug: "m11", level: "A", name: "LEAFS VERDUN", teamId: "20261914019128" },
  { categorySlug: "m11", level: "B", name: "BRONCOS VERDUN", teamId: "2025191400036563" },
  { categorySlug: "m11", level: "B", name: "BULLDOGS VERDUN", teamId: "2025191400019259" },
  { categorySlug: "m11", level: "C", name: "COYOTES VERDUN", teamId: "2025191400019495" },

  { categorySlug: "feminin", level: "M12 A féminin", name: "LOUVES VERDUN", teamId: "2025191400035012" },

  { categorySlug: "m13", level: "A", name: "LEAFS VERDUN", teamId: "2025191400022838" },
  { categorySlug: "m13", level: "B", name: "BULLDOGS VERDUN", teamId: "2025191400023172" },
  { categorySlug: "m13", level: "C", name: "COYOTES VERDUN", teamId: "2025191400028967" },

  { categorySlug: "m15", level: "A", name: "LEAFS VERDUN", teamId: "2025191400023578" },
  { categorySlug: "m15", level: "B", name: "BULLDOGS VERDUN", teamId: "2025191400023783" },

  { categorySlug: "m18", level: "A", name: "LEAFS VERDUN", teamId: "2025191400024357" },
  { categorySlug: "m18", level: "B", name: "BULLDOGS VERDUN", teamId: "2025191400033752" },

  { categorySlug: "junior", level: "C", name: "LEAFS VERDUN", teamId: "2025191400035011" },
  { categorySlug: "junior", level: "D", name: "LEAFS VERDUN", teamId: "2025191400025121" },
] as const;
