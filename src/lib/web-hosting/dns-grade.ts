// Reads a domain's public DNS the way the rest of the internet sees it and
// says what is missing for the website and for email (MX, SPF, DMARC).
// Pure, so it is tested without a network.

export type DnsStatus = "pass" | "warn" | "fail";

export interface DnsFacts {
  domain: string;
  a: string[];
  aaaa: string[];
  wwwResolves: boolean;
  ns: string[];
  mx: Array<{ exchange: string; priority: number }>;
  txt: string[];
  dmarc: string[];
}

export interface DnsCheck {
  key: string;
  label: string;
  status: DnsStatus;
  detail: string;
}

export interface DnsReport {
  domain: string;
  checks: DnsCheck[];
  records: Array<{ type: string; value: string }>;
}

export function gradeDns(facts: DnsFacts): DnsReport {
  const checks: DnsCheck[] = [];
  const add = (key: string, label: string, status: DnsStatus, detail: string) => checks.push({ key, label, status, detail });

  add(
    "website",
    "Le domaine mène au site · The domain points to the website",
    facts.a.length || facts.aaaa.length ? "pass" : "fail",
    facts.a.length || facts.aaaa.length
      ? `Adresse ${[...facts.a, ...facts.aaaa].slice(0, 3).join(", ")} · Address found.`
      : "Aucune adresse (A/AAAA) : le site ne s’ouvre pas · No A/AAAA record: the site does not open.",
  );
  add(
    "www",
    "La version www fonctionne · The www version works",
    facts.wwwResolves ? "pass" : "warn",
    facts.wwwResolves ? `www.${facts.domain} répond · answers.` : `www.${facts.domain} ne répond pas : ajouter un enregistrement · add a record.`,
  );
  add(
    "ns",
    "Serveurs de noms · Name servers",
    facts.ns.length >= 2 ? "pass" : facts.ns.length === 1 ? "warn" : "fail",
    facts.ns.length ? facts.ns.slice(0, 4).join(", ") : "Aucun serveur de noms · No name server.",
  );

  const spf = facts.txt.filter((value) => /^v=spf1\b/i.test(value.trim()));
  const hasMail = facts.mx.length > 0;
  add(
    "mx",
    "Réception du courriel (MX) · Receiving email (MX)",
    hasMail ? "pass" : "warn",
    hasMail
      ? facts.mx.slice().sort((x, y) => x.priority - y.priority).slice(0, 3).map((m) => m.exchange).join(", ")
      : "Aucun MX : les courriels envoyés à ce domaine sont refusés · No MX: email sent to this domain is refused.",
  );
  add(
    "spf",
    "Expéditeurs autorisés (SPF) · Allowed senders (SPF)",
    spf.length === 1 ? (/[~-]all\b/i.test(spf[0]) ? "pass" : "warn") : spf.length > 1 ? "fail" : hasMail ? "fail" : "warn",
    spf.length === 1
      ? /[~-]all\b/i.test(spf[0])
        ? "Présent · Present."
        : "Présent mais trop permissif (pas de ~all ou -all) · Present but too permissive."
      : spf.length > 1
        ? "Plusieurs SPF : les serveurs les rejettent, n’en garder qu’un · Several SPF records: keep only one."
        : "Absent : vos courriels risquent d’aller aux pourriels · Missing: your emails may land in spam.",
  );
  const dmarc = facts.dmarc.find((value) => /^v=DMARC1\b/i.test(value.trim())) ?? null;
  const policy = dmarc ? (/\bp=(none|quarantine|reject)\b/i.exec(dmarc)?.[1]?.toLowerCase() ?? null) : null;
  add(
    "dmarc",
    "Protection contre l’usurpation (DMARC) · Spoofing protection (DMARC)",
    policy === "quarantine" || policy === "reject" ? "pass" : dmarc ? "warn" : hasMail ? "fail" : "warn",
    policy === "quarantine" || policy === "reject"
      ? `Politique ${policy} · Policy ${policy}.`
      : dmarc
        ? "Présent en mode observation (p=none) · Present in watch mode (p=none)."
        : "Absent : n’importe qui peut envoyer au nom de ce domaine · Missing: anyone can send as this domain.",
  );

  const records = [
    ...facts.a.map((value) => ({ type: "A", value })),
    ...facts.aaaa.map((value) => ({ type: "AAAA", value })),
    ...facts.ns.map((value) => ({ type: "NS", value })),
    ...facts.mx.map((m) => ({ type: "MX", value: `${m.priority} ${m.exchange}` })),
    ...facts.txt.map((value) => ({ type: "TXT", value: value.slice(0, 300) })),
    ...facts.dmarc.map((value) => ({ type: "TXT (_dmarc)", value: value.slice(0, 300) })),
  ];
  return { domain: facts.domain, checks, records };
}
