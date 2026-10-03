type HockeySmsEvent = {
  teamId: string;
  title: string;
  startsAt: Date;
  timezone: string;
  arenaName: string | null;
  arenaAddress: string | null;
  status: string;
  sourceUrl: string | null;
};

function localeFor(value: string | null | undefined): "fr-CA" | "en-CA" | "es-CA" {
  const locale = value?.toLowerCase() ?? "";
  if (locale.startsWith("es")) return "es-CA";
  if (locale.startsWith("en")) return "en-CA";
  return "fr-CA";
}

function eventTime(event: HockeySmsEvent, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: event.timezone,
    }).format(event.startsAt);
  } catch {
    return event.startsAt.toISOString();
  }
}

function clampSms(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

export function buildHockeySms(input: {
  kind: "sms_reminder" | "sms_event_change";
  locale?: string | null;
  event: HockeySmsEvent;
}): string {
  const locale = localeFor(input.locale);
  const when = eventTime(input.event, locale);
  const place = input.event.arenaName || input.event.arenaAddress || "";
  const source = input.event.sourceUrl ? ` ${input.event.sourceUrl}` : "";

  if (input.kind === "sms_event_change") {
    if (input.event.status === "cancelled") {
      if (locale === "en-CA") {
        return clampSms(`AHMV: CANCELLED — ${input.event.title}, ${when}. Check the official source before leaving.${source}`);
      }
      if (locale === "es-CA") {
        return clampSms(`AHMV: CANCELADO — ${input.event.title}, ${when}. Verifica la fuente oficial antes de salir.${source}`);
      }
      return clampSms(`AHMV : ANNULÉ — ${input.event.title}, ${when}. Vérifiez la source officielle avant de partir.${source}`);
    }

    if (locale === "en-CA") {
      return clampSms(`AHMV: Schedule update — ${input.event.title}, ${when}${place ? `, ${place}` : ""}. Check the latest official details.${source}`);
    }
    if (locale === "es-CA") {
      return clampSms(`AHMV: Cambio de horario — ${input.event.title}, ${when}${place ? `, ${place}` : ""}. Verifica los detalles oficiales.${source}`);
    }
    return clampSms(`AHMV : Horaire modifié — ${input.event.title}, ${when}${place ? `, ${place}` : ""}. Vérifiez les derniers détails officiels.${source}`);
  }

  if (locale === "en-CA") {
    return clampSms(`AHMV reminder: ${input.event.title}, ${when}${place ? `, ${place}` : ""}.${source}`);
  }
  if (locale === "es-CA") {
    return clampSms(`Recordatorio AHMV: ${input.event.title}, ${when}${place ? `, ${place}` : ""}.${source}`);
  }
  return clampSms(`Rappel AHMV : ${input.event.title}, ${when}${place ? `, ${place}` : ""}.${source}`);
}
