function localeFor(value: string | null | undefined): "fr-CA" | "en-CA" | "es-CA" {
  const locale = value?.toLowerCase() ?? "";
  if (locale.startsWith("es")) return "es-CA";
  if (locale.startsWith("en")) return "en-CA";
  return "fr-CA";
}

function localTime(date: Date, timezone: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function minutes(seconds: number) {
  return Math.max(1, Math.ceil(seconds / 60));
}

function clamp(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

export function buildHockeyDepartureSms(input: {
  locale?: string | null;
  title: string;
  timezone: string;
  leaveBy: Date;
  durationSeconds: number;
  trafficDelaySeconds: number;
  arenaName?: string | null;
  sourceUrl?: string | null;
}): string {
  const locale = localeFor(input.locale);
  const leave = localTime(input.leaveBy, input.timezone, locale);
  const trip = minutes(input.durationSeconds);
  const delay = Math.max(0, minutes(input.trafficDelaySeconds));
  const arena = input.arenaName ? ` · ${input.arenaName}` : "";
  const source = input.sourceUrl ? ` ${input.sourceUrl}` : "";

  if (locale === "en-CA") {
    return clamp(
      `AHMV: leave by ${leave} for ${input.title}${arena}. Estimated drive ${trip} min${input.trafficDelaySeconds > 0 ? `, about ${delay} min traffic delay` : ""}. Recheck traffic before leaving.${source}`,
    );
  }

  if (locale === "es-CA") {
    return clamp(
      `AHMV: sal antes de las ${leave} para ${input.title}${arena}. Trayecto estimado ${trip} min${input.trafficDelaySeconds > 0 ? `, aprox. ${delay} min de retraso por tráfico` : ""}. Verifica el tráfico antes de salir.${source}`,
    );
  }

  return clamp(
    `AHMV : pars au plus tard à ${leave} pour ${input.title}${arena}. Trajet estimé ${trip} min${input.trafficDelaySeconds > 0 ? `, environ ${delay} min de délai trafic` : ""}. Revérifie le trafic avant de partir.${source}`,
  );
}
