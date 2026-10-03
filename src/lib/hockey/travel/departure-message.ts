type SmartDepartureMessageInput = {
  locale?: string | null;
  title: string;
  arenaName: string | null;
  startsAt: Date;
  timezone: string;
  leaveAt: Date;
  leaveNow: boolean;
  arrivalBufferMinutes: number;
  durationSeconds: number;
  trafficDelayMinutes: number;
};

function localeFor(value: string | null | undefined): "fr-CA" | "en-CA" | "es-CA" {
  const locale = value?.toLowerCase() ?? "";
  if (locale.startsWith("en")) return "en-CA";
  if (locale.startsWith("es")) return "es-CA";
  return "fr-CA";
}

function clock(value: Date, timezone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(value);
  } catch {
    return value.toISOString().slice(11, 16);
  }
}

function minutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

function clamp(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

export function buildSmartDepartureSms(input: SmartDepartureMessageInput): string {
  const locale = localeFor(input.locale);
  const leave = clock(input.leaveAt, input.timezone, locale);
  const start = clock(input.startsAt, input.timezone, locale);
  const trip = minutes(input.durationSeconds);
  const arena = input.arenaName ? ` — ${input.arenaName}` : "";
  const delay =
    input.trafficDelayMinutes >= 5
      ? input.trafficDelayMinutes
      : 0;

  if (locale === "en-CA") {
    const when = input.leaveNow ? "LEAVE NOW" : `Leave by ${leave}`;
    const traffic = delay ? ` Traffic adds about ${delay} min.` : "";
    return clamp(
      `AHMV smart departure: ${when} for ${input.title}${arena}. Drive ~${trip} min; target arrival ${input.arrivalBufferMinutes} min before the ${start} start.${traffic}`,
    );
  }

  if (locale === "es-CA") {
    const when = input.leaveNow ? "SAL AHORA" : `Sal a más tardar a las ${leave}`;
    const traffic = delay ? ` El tráfico agrega aprox. ${delay} min.` : "";
    return clamp(
      `Salida inteligente AHMV: ${when} para ${input.title}${arena}. Trayecto ~${trip} min; llegada prevista ${input.arrivalBufferMinutes} min antes del inicio a las ${start}.${traffic}`,
    );
  }

  const when = input.leaveNow ? "PARTEZ MAINTENANT" : `Partez au plus tard à ${leave}`;
  const traffic = delay ? ` Le trafic ajoute environ ${delay} min.` : "";
  return clamp(
    `Départ intelligent AHMV : ${when} pour ${input.title}${arena}. Trajet ~${trip} min; arrivée visée ${input.arrivalBufferMinutes} min avant le début à ${start}.${traffic}`,
  );
}
