// Reads a redirect chain (each hop's address and status) and says what to
// fix for visitors and for Google. Pure, so it is tested without a network.

export interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
}

export type RedirectStatus = "pass" | "warn" | "fail";

export interface RedirectFinding {
  key: string;
  status: RedirectStatus;
  detail: string;
}

export interface RedirectReport {
  start: string;
  finalUrl: string | null;
  finalStatus: number | null;
  hops: RedirectHop[];
  findings: RedirectFinding[];
}

export function gradeRedirects(start: string, hops: RedirectHop[], stopped: "loop" | "too_many" | "unreachable" | null): RedirectReport {
  const findings: RedirectFinding[] = [];
  const last = hops.at(-1) ?? null;
  const redirects = hops.filter((hop) => hop.status >= 300 && hop.status < 400);

  if (stopped === "loop") {
    findings.push({ key: "loop", status: "fail", detail: "Boucle de redirections : la page ne s’ouvre jamais · Redirect loop: the page never opens." });
  } else if (stopped === "too_many") {
    findings.push({ key: "too_many", status: "fail", detail: "Trop de redirections (plus de 10) · Too many redirects (over 10)." });
  } else if (stopped === "unreachable") {
    findings.push({ key: "unreachable", status: "fail", detail: "Une adresse de la chaîne ne répond pas · An address in the chain does not answer." });
  } else if (last) {
    if (last.status >= 200 && last.status < 300) {
      findings.push({ key: "final", status: "pass", detail: `La page finale s’ouvre (${last.status}) · The final page opens.` });
    } else if (last.status === 404 || last.status === 410) {
      findings.push({ key: "final", status: "fail", detail: `La page finale n’existe pas (${last.status}) · The final page does not exist.` });
    } else {
      findings.push({ key: "final", status: last.status >= 500 ? "fail" : "warn", detail: `La page finale répond ${last.status} · The final page answers ${last.status}.` });
    }
  }

  if (redirects.length === 0 && !stopped) {
    findings.push({ key: "count", status: "pass", detail: "Aucune redirection · No redirect." });
  } else if (redirects.length <= 2) {
    findings.push({ key: "count", status: "pass", detail: `${redirects.length} redirection(s) · redirect(s).` });
  } else {
    findings.push({ key: "count", status: "warn", detail: `${redirects.length} redirections : viser une seule pour la vitesse et Google · aim for one, for speed and Google.` });
  }

  const temporary = redirects.filter((hop) => hop.status === 302 || hop.status === 307);
  if (temporary.length) {
    findings.push({
      key: "temporary",
      status: "warn",
      detail: `${temporary.length} redirection(s) temporaire(s) (302/307) : pour un déménagement définitif, utiliser 301 · Temporary redirects: use 301 for a permanent move.`,
    });
  }
  if (redirects.some((hop) => hop.location && hop.url.startsWith("https://") && hop.location.startsWith("http://"))) {
    findings.push({ key: "downgrade", status: "fail", detail: "Une redirection repasse de https à http (non chiffré) · A redirect goes from https back to http." });
  }

  return { start, finalUrl: stopped ? null : last?.url ?? null, finalStatus: stopped ? null : last?.status ?? null, hops, findings };
}
