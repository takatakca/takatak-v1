// Grades what a public website shows about its security: HTTPS, the
// redirect from http, the certificate and the security headers. Pure, so it
// is tested without a network. Each check says what it means in plain words.

export type SecurityStatus = "pass" | "warn" | "fail";

export interface SecurityCheck {
  key: string;
  label: string;
  status: SecurityStatus;
  detail: string;
}

export interface SecurityFacts {
  host: string;
  /** The https:// home page answered (any status below 500). */
  httpsOk: boolean;
  /** http:// sends visitors to https:// (null when http could not be reached). */
  httpRedirectsToHttps: boolean | null;
  /** Lower-case header names of the final https response. */
  headers: Record<string, string>;
  certificate: { trusted: boolean; daysLeft: number | null; issuer: string | null } | null;
}

export interface SecurityReport {
  host: string;
  score: number;
  checks: SecurityCheck[];
}

const WEIGHT: Record<string, number> = {
  https: 25,
  certificate: 20,
  redirect: 15,
  hsts: 10,
  frames: 10,
  nosniff: 5,
  csp: 5,
  referrer: 5,
  permissions: 3,
  banner: 2,
};

export function gradeSecurity(facts: SecurityFacts): SecurityReport {
  const h = facts.headers;
  const checks: SecurityCheck[] = [];
  const add = (key: string, label: string, status: SecurityStatus, detail: string) => checks.push({ key, label, status, detail });

  add(
    "https",
    "Connexion chiffrée (HTTPS) · Encrypted connection",
    facts.httpsOk ? "pass" : "fail",
    facts.httpsOk ? "Le site répond en HTTPS · The site answers over HTTPS." : "Le site ne répond pas en HTTPS · The site does not answer over HTTPS.",
  );

  const cert = facts.certificate;
  if (!cert) {
    add("certificate", "Certificat SSL · SSL certificate", "fail", "Aucun certificat lisible · No readable certificate.");
  } else if (!cert.trusted) {
    add("certificate", "Certificat SSL · SSL certificate", "fail", "Certificat non reconnu par les navigateurs · Certificate not trusted by browsers.");
  } else if (cert.daysLeft !== null && cert.daysLeft < 14) {
    add("certificate", "Certificat SSL · SSL certificate", cert.daysLeft < 0 ? "fail" : "warn", `Expire dans ${cert.daysLeft} jours · Expires in ${cert.daysLeft} days.`);
  } else {
    add(
      "certificate",
      "Certificat SSL · SSL certificate",
      "pass",
      `Valide${cert.daysLeft !== null ? `, encore ${cert.daysLeft} jours` : ""}${cert.issuer ? ` (${cert.issuer})` : ""} · Valid${cert.daysLeft !== null ? `, ${cert.daysLeft} days left` : ""}.`,
    );
  }

  add(
    "redirect",
    "Redirection vers HTTPS · Redirect to HTTPS",
    facts.httpRedirectsToHttps === true ? "pass" : facts.httpRedirectsToHttps === null ? "warn" : "fail",
    facts.httpRedirectsToHttps === true
      ? "Les visiteurs en http:// sont envoyés vers https:// · http:// visitors are sent to https://."
      : facts.httpRedirectsToHttps === null
        ? "La version http:// n’a pas répondu · The http:// version did not answer."
        : "La version http:// reste non chiffrée · The http:// version stays unencrypted.",
  );

  const hsts = h["strict-transport-security"] ?? "";
  const maxAge = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? 0);
  add(
    "hsts",
    "HTTPS imposé (HSTS) · HTTPS enforced (HSTS)",
    maxAge >= 15_552_000 ? "pass" : maxAge > 0 ? "warn" : "fail",
    maxAge >= 15_552_000 ? "Les navigateurs gardent HTTPS au moins 6 mois · Browsers keep HTTPS for 6 months or more." : maxAge > 0 ? "Durée trop courte (moins de 6 mois) · Duration too short (under 6 months)." : "En-tête absent · Header missing.",
  );

  const csp = h["content-security-policy"] ?? "";
  const frameSafe = /frame-ancestors/i.test(csp) || /^(deny|sameorigin)$/i.test((h["x-frame-options"] ?? "").trim());
  add(
    "frames",
    "Protection contre l’encadrement · Clickjacking protection",
    frameSafe ? "pass" : "fail",
    frameSafe ? "Le site ne peut pas être piégé dans une autre page · The site cannot be framed by another page." : "Ajouter X-Frame-Options ou frame-ancestors · Add X-Frame-Options or frame-ancestors.",
  );

  add(
    "nosniff",
    "Types de fichiers stricts · Strict file types",
    /nosniff/i.test(h["x-content-type-options"] ?? "") ? "pass" : "warn",
    /nosniff/i.test(h["x-content-type-options"] ?? "") ? "X-Content-Type-Options: nosniff." : "Ajouter X-Content-Type-Options: nosniff · Add it.",
  );

  add(
    "csp",
    "Politique de contenu (CSP) · Content security policy",
    csp ? "pass" : "warn",
    csp ? "Présente · Present." : "Absente : limite les scripts permis · Missing: it limits which scripts may run.",
  );

  add(
    "referrer",
    "Politique de référent · Referrer policy",
    h["referrer-policy"] ? "pass" : "warn",
    h["referrer-policy"] ? `${h["referrer-policy"]}.` : "Absente · Missing.",
  );

  add(
    "permissions",
    "Permissions du navigateur · Browser permissions",
    h["permissions-policy"] ? "pass" : "warn",
    h["permissions-policy"] ? "Présente · Present." : "Absente · Missing.",
  );

  const banner = [h["server"], h["x-powered-by"]].filter(Boolean).join(" ");
  const leaksVersion = /\d+\.\d+/.test(banner);
  add(
    "banner",
    "Versions cachées · Versions hidden",
    leaksVersion ? "warn" : "pass",
    leaksVersion ? `Le serveur annonce sa version (${banner.slice(0, 60)}) · The server shows its version.` : "Le serveur n’annonce pas de version · No version shown.",
  );

  const score = Math.round(
    checks.reduce((total, check) => total + (WEIGHT[check.key] ?? 0) * (check.status === "pass" ? 1 : check.status === "warn" ? 0.5 : 0), 0),
  );
  return { host: facts.host, score, checks };
}
