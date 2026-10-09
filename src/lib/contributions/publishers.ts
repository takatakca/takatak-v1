import "server-only";

export const AHMV_PUBLISHER = {
  code: "ahmv",
  brandWebsite: "https://ahmverdun.ca",
  moderatorEmail:
    process.env.AHMV_CONTRIBUTION_MODERATOR_EMAIL?.trim() ||
    "OHMVVerdun.ca@gmail.com",
  dashboardPath: "/dashboard/contributions?publisher=ahmv",
} as const;
