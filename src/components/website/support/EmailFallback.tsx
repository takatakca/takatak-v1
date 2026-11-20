"use client";

// Shown when the website cannot record a request (the server refused or is
// unreachable). The client's request is already written into an email to
// TAKATAK support, so no order, project or question is lost while online
// sending is paused.
import { Mail } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/website/live-chat-config";

type Lang = "fr" | "en";

const MAX_BODY = 1800; // Keeps the mailto link short enough for every mail app.

export function supportMailto(subject: string, lines: ReadonlyArray<string | false | null | undefined>): string {
  const body = lines
    .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    .join("\n")
    .slice(0, MAX_BODY);
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const COPY = {
  lead: {
    fr: "L’envoi en ligne est en pause. Votre demande est déjà écrite dans un courriel : il ne reste qu’à l’envoyer.",
    en: "Online sending is paused. Your request is already written in an email: you only need to send it.",
  },
  open: { fr: "Envoyer par courriel", en: "Send by email" },
} as const;

export function EmailFallback({
  lang,
  subject,
  lines,
  tone = "light",
  className = "",
}: {
  lang: Lang;
  subject: string;
  lines: ReadonlyArray<string | false | null | undefined>;
  tone?: "light" | "dark";
  className?: string;
}) {
  const box =
    tone === "dark"
      ? "border-white/20 bg-white/10 text-white"
      : "border-border bg-secondary/40 text-foreground";
  const link = tone === "dark" ? "text-white" : "text-primary";
  return (
    <div role="alert" className={`rounded-xl border p-3.5 text-sm ${box} ${className}`}>
      <p>{COPY.lead[lang]}</p>
      <a
        href={supportMailto(subject, lines)}
        className={`mt-2 inline-flex items-center gap-2 font-semibold underline-offset-4 hover:underline ${link}`}
      >
        <Mail size={15} aria-hidden /> {COPY.open[lang]} ({SUPPORT_EMAIL})
      </a>
    </div>
  );
}
