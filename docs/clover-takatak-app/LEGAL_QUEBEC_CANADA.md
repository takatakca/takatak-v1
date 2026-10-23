# Legal research: Québec and Canada

> **NOT LEGAL ADVICE — À VALIDER PAR UN AVOCAT DU QUÉBEC / TO VALIDATE WITH A QUÉBEC LAWYER.**
>
> This file was written by an AI research assistant on 2026-10-23 from public law texts. It lists the rules that seem to
> apply and the questions to ask. It does not say what the law requires for TAKATAK in a binding way. Before launch, a
> member of the Barreau du Québec reviews the privacy policy, the EULA, the data processing agreement and the questions
> in section 12. Ce document n'est pas un avis juridique.

**FACT** = what the law text says (source and date). **INFERENCE** = our reading, to be confirmed by the lawyer.

## Sources read (2026-10-23)

| Text | Where | Version shown |
|---|---|---|
| Act respecting the protection of personal information in the private sector, CQLR c. P-39.1 ("Law 25" amendments) | https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1 | consolidated text read 2026-10-23 |
| Regulation respecting confidentiality incidents (O.C. 1761-2022) | https://www.legisquebec.gouv.qc.ca (regulations under P-39.1) | read 2026-10-23 |
| CAI guide "Réaliser une évaluation des facteurs relatifs à la vie privée" | Commission d'accès à l'information (cai.gouv.qc.ca) | version 3.1, April 2024 |
| Charter of the French language, CQLR c. C-11 | https://www.legisquebec.gouv.qc.ca/en/document/cs/C-11 | current to 2026-08-12 |
| OQLF "Votre aide-mémoire pour faire des affaires en français au Québec" and "Affichage des marques de commerce et des noms d'entreprises" | oqlf.gouv.qc.ca | rules in force since 2025-06-01 |
| Civil Code of Québec | https://www.legisquebec.gouv.qc.ca/en/document/cs/CCQ-1991 | read 2026-10-23 |
| Consumer Protection Act, CQLR c. P-40.1 | https://www.legisquebec.gouv.qc.ca/en/document/cs/P-40.1 | read 2026-10-23 |
| PIPEDA, S.C. 2000, c. 5 | https://laws-lois.justice.gc.ca/eng/acts/P-8.6/ | current to 2026-09-30 |
| Breach of Security Safeguards Regulations, SOR/2018-64 | https://laws-lois.justice.gc.ca/eng/regulations/SOR-2018-64/ | read 2026-10-23 |
| Organizations in the Province of Quebec Exemption Order, SOR/2003-374 | https://laws-lois.justice.gc.ca/eng/regulations/SOR-2003-374/ | modified 2026-10-15 |
| Canada's Anti-Spam Legislation (CASL), S.C. 2010, c. 23 | https://laws-lois.justice.gc.ca/eng/acts/E-1.6/ | current to 2026-09-30 |
| Competition Act, R.S.C. 1985, c. C-34 | https://laws-lois.justice.gc.ca/eng/acts/C-34/ | current to 2026-09-30 |
| Food and Drugs Act, R.S.C. 1985, c. F-27 | https://laws-lois.justice.gc.ca/eng/acts/F-27/ | current to 2026-09-30 |
| Clover, Google, Meta contract terms | see [RESEARCH_CLOVER.md](RESEARCH_CLOVER.md), [RESEARCH_GOOGLE.md](RESEARCH_GOOGLE.md), [RESEARCH_META_AND_CHANNELS.md](RESEARCH_META_AND_CHANNELS.md) | read 2026-10-23 |

## 1. Who is who (roles)

| Party | Role (INFERENCE) |
|---|---|
| The restaurant (Clover merchant) | Holds its customers' and staff's personal information; owns its Google, Facebook, Instagram and Pinterest accounts; is the advertiser of its own posts |
| TAKATAK (the contracting entity, to be named — see decision D9) | Service provider to the restaurant: Clover calls it the merchant's "service provider or processor" (Developer Terms s.18.1); Meta calls it a "Tech Provider" (Platform Terms s.5.b); Google calls it a "third party" manager. Under P-39.1 s.18.3 it would be the party performing a mandate or contract for services |
| Clover Network LLC | Operator of the App Market for Canada; collects app fees; not a party to the TAKATAK EULA |
| Google, Meta, Pinterest | Recipients chosen by the merchant ("as the merchant directs"); each has its own terms with TAKATAK and with the merchant |
| Sub-processors of TAKATAK | Database host (Supabase, region `eu-west-1` for takatak-v1 today), AI model provider, hosting (Coolify server), email or SMS provider if used |

**What data is personal (INFERENCE).** Menus, prices, hours, addresses of businesses and dish photos are mostly business
information. Personal information still appears: the owner's and staff's names, emails and phone numbers; people in
photos; reviewers' names and review texts imported from Google; comments on Facebook posts; IP addresses in logs.

## 2. Québec private-sector privacy law (P-39.1, as amended by Law 25)

**FACT** (consolidated text read 2026-10-23):

| Section | What it says (short) | What it means for TAKATAK (INFERENCE) |
|---|---|---|
| 3.1 | The person with the highest authority ensures compliance and is the person in charge of the protection of personal information; may delegate in writing; title and contact information published on the website | Name the person in charge (decision D8); publish title and a role address on takatak.ca/privacy |
| 3.2 | Governance policies and practices (keeping and destruction, roles, complaints), approved by the person in charge, published in clear language on the website | Publish a short governance page: retention, roles, complaint process |
| 3.3 | A privacy impact assessment (PIA) for any project to acquire, develop or overhaul an information system involving personal information; consult the person in charge from the outset; data portable in a structured, common format | The TAKATAK Clover app is such a project: PIA before build (CAI guide v3.1) |
| 3.5 | After a confidentiality incident: reduce risk; if risk of serious injury, promptly notify the Commission d'accès à l'information and the people concerned | Incident runbook for the app |
| 3.8 + Regulation (O.C. 1761-2022) | Keep a register of confidentiality incidents with prescribed content; send to the Commission on request | One register for all TAKATAK products |
| 8 | At collection: purposes, means, rights of access and rectification, right to withdraw consent; names or categories of third parties; possibility of communication outside Québec | Privacy policy and onboarding screen must say this, incl. "outside Québec" |
| 8.1 | Before using technology that can identify, locate or profile a person: inform, and explain how to activate those functions | Check analytics and any audience features; none should profile customers by default |
| 8.2 | A confidentiality policy in clear and simple language on the website when collecting by technological means | App-specific section on takatak.ca/privacy |
| 9.1 | Products offered to the public with privacy settings: highest confidentiality by default | Defaults: no auto-publish, no sharing beyond the chosen channels |
| 12.1 | A decision based exclusively on automated processing of personal information: inform the person, explain on request, allow review by a person | Unlikely to apply to post writing; check AI review replies and any AI "scoring" |
| 14 | Consent must be clear, free, informed, for specific purposes, asked for each purpose in clear language, separately from other information | Channel-by-channel consent screens, separate from the EULA |
| 17 | Before communicating personal information outside Québec (incl. entrusting it to a provider outside Québec): a PIA (sensitivity, purposes, protection measures, foreign legal framework); communicate only if protection is adequate; a written agreement | Applies to `eu-west-1` (Ireland) database, US-based AI providers, and Google/Meta/Pinterest servers. PIA + written agreements, or move data to `ca-central-1` (decision D10) |
| 18.3 | Personal information may be communicated without consent to a mandatary or service provider if the mandate is in writing and states protection measures, use only for the mandate, and no keeping after it ends | The merchant–TAKATAK agreement (DPA) and TAKATAK–sub-processor agreements must say this |
| 90.12 | Administrative monetary penalty up to $10,000,000 or 2% of worldwide turnover (greater amount) for an enterprise | — |
| 91 | Penal offences (e.g. unlawful collection or use, failing to report an incident, missing security measures) | — |

## 3. Federal privacy law (PIPEDA)

- **FACT.** The Quebec Exemption Order exempts organizations covered by P-39.1 from Part 1 of PIPEDA "in respect of the
  collection, use and disclosure of personal information that occurs within the Province of Quebec".
- **FACT.** Breach of Security Safeguards Regulations: keep a record of every breach for 24 months after determining that
  it occurred.
- **INFERENCE.** PIPEDA still applies to information crossing provincial or national borders (merchants outside Québec;
  data stored in Ireland; transfers to US platforms). Clover also asks for a privacy policy "addressing PIPEDA". The
  privacy policy should cover both laws; the incident process should cover both (CAI notice and OPC report when there is
  a real risk of significant harm).

## 4. Charter of the French language

**FACT** (current to 2026-08-12):
- s.51: inscriptions on products in French — "This rule applies also to menus and wine lists."
- s.52: catalogues, brochures, folders and similar documents in French, in any medium.
- s.52.1: software (incl. its interface) available in French unless no French version exists.
- s.55: a contract of adhesion binds in another language only if the French version was given first and the parties
  then expressly chose another language (not for parties outside Québec).
- s.58: public signs and commercial advertising in French; bilingual allowed if French is markedly predominant.
- s.58.1: a trademark may stay in another language in signs and advertising if it is registered and no French version is
  registered (conditions apply).

**FACT (OQLF guidance).** Commercial documentation (invoices, catalogues, brochures, **websites and social media pages**)
must be at least in French, in any medium; another language is allowed if French is at least equivalent and as easy to
reach. "La responsabilité de diffuser du contenu en français appartient à celui ou celle qui rend l'information
disponible au public." Since 2023-06-01 a French version of a contract of adhesion must be given before agreement, not
only on request. New display rules for trademarks and business names are in force since 2025-06-01.

**INFERENCE.**
- The TAKATAK app UI, emails, errors, help and listing: French first, English available.
- EULA: French version shown first; English only after an express choice.
- Posts, menus and Google descriptions for a Québec restaurant: French by default, or bilingual with French at least
  equivalent (pages, menus) / markedly predominant (advertising). The generator enforces this by default; the merchant
  can add English.
- TAKATAK publishes on the merchant's behalf: who is "the one making the information available" (merchant, TAKATAK, or
  both) is a lawyer question.

## 5. Contracts: Civil Code of Québec

- **FACT.** Art. 1435: in a contract of adhesion, an external clause (for example terms on another web page) is null if
  it was not expressly brought to the adhering party's attention, unless they knew of it. Art. 1436: an illegible or
  incomprehensible clause is null if the adhering party suffers injury, unless it was adequately explained. Art. 1437: an
  abusive clause (excessively and unreasonably detrimental, contrary to good faith) is null or reduced. Art. 2130:
  mandate = power to represent in a juridical act with a third person.
- **INFERENCE.**
  - The EULA is a contract of adhesion: short, readable, French first; key clauses (liability limits, auto-renewal via
    Clover, data use, publishing on the merchant's behalf) shown on screen, not only by link.
  - Liability caps must not be abusive (for example, excluding all liability for posts TAKATAK's AI wrote and the
    merchant approved may be fine; excluding liability for TAKATAK's own security failures may not).
  - Publishing posts is mostly a material act (contract for services), but replying to reviews or editing a Google
    profile "in the name of" the restaurant may be a representation: the EULA should give an express authorization.

## 6. Consumer protection (P-40.1)

- **FACT.** The Act defines "consumer" to exclude a merchant who obtains goods or services for the purposes of his
  business. s.219: no false or misleading representation to a consumer, by any means. s.224(c): no charging a higher
  price than the advertised price. s.248: no commercial advertising directed at persons under 13 (subject to
  regulations).
- **INFERENCE.**
  - The TAKATAK–restaurant contract is business to business: the consumer rules mostly do not apply to it.
  - The posts are advertising **to consumers** by the restaurant. Prices on Google menus and in posts must match the
    price really charged (from Clover); promotions must be real; nothing aimed at children under 13 (for example
    "kids' meal" cartoons or games). The generator must use Clover prices only and never invent discounts.
  - Whether TAKATAK can be treated as an "advertiser" for posts it writes: lawyer question.

## 7. Competition Act (marketing claims)

- **FACT.** s.74.01(1)(a): reviewable conduct to make a representation to the public "that is false or misleading in a
  material respect"; (b): a performance claim not based on "an adequate and proper test", proof on the person making it.
  The "general impression conveyed by a representation as well as its literal meaning" are taken into account. s.52 is
  the criminal version for knowing or reckless misrepresentations. "Drip pricing": a price "that is not attainable due
  to fixed obligatory charges or fees constitutes a false or misleading representation" (taxes excepted).
- **FACT (secondary).** Canadian marketing and law-firm summaries report that the Competition Bureau treats AI claims
  like any other claim and expects them to be clear and substantiated (see [MARKET_AND_CLAIMS.md](MARKET_AND_CLAIMS.md)).
- **INFERENCE.**
  - "The first AI backend", "the only…", "guaranteed more orders", "#1 on Google" are risky without proof.
  - Performance claims about the app ("restaurants get X% more orders") need a real test before use.
  - Posts written for restaurants: no invented reviews, quotes, awards or "best in Montréal" claims; real prices
    including mandatory fees (no drip pricing).

## 8. Anti-spam (CASL)

- **FACT.** CASL forbids sending a commercial electronic message (CEM) "to an electronic address" without consent and the
  required content. An electronic address is an address for "an electronic mail account", "an instant messaging
  account", "a telephone account" or "any similar account". Implied consent includes a business address that was
  conspicuously published without a "no unsolicited messages" statement, when the message is relevant to the person's
  business role.
- **INFERENCE.**
  - A public post on the restaurant's own Page, Instagram or Google profile is not sent to an electronic address: likely
    not a CEM. Lawyer to confirm.
  - Direct messages, emails and SMS **are** CEMs: if TAKATAK later sends DMs, emails or SMS for restaurants, consent,
    sender identification and an unsubscribe are needed.
  - TAKATAK prospecting other restaurants by email or SMS ("take other people's businesses") is a CEM from TAKATAK:
    consent or the conspicuous-publication exemption, identification and unsubscribe every time.

## 9. Food advertising

- **FACT.** Food and Drugs Act s.5(1): no person shall "label, package, treat, process, sell or advertise any food in a
  manner that is false, misleading or deceptive or is likely to create an erroneous impression regarding its character,
  value, quantity, composition, merit or safety."
- **INFERENCE.** The AI never invents allergen, dietary or health claims ("gluten-free", "vegan", "healthy", "halal",
  "organic", "no MSG"). Such words appear only if the merchant entered them in Clover or TAKATAK. Google's menu allergen
  fields are filled only from merchant data.

## 10. Photos, names and trademarks

- **INFERENCE.**
  - Photos: the merchant uploads or chooses them and warrants it has the rights (and the consent of people shown). The
    EULA licenses TAKATAK to publish them only to the channels the merchant chose.
  - AI images: never presented as a real dish (Google asks photos to "represent reality"; Food and Drugs Act s.5). If
    ever used, labelled as AI (Instagram has an `is_ai_generated` field).
  - Platform names and logos: used only to describe compatibility, following each brand's guidelines; never in the app
    name or icon; never suggesting partnership or endorsement (Google and Clover rules).
  - "TAKATAK": registering the trademark with the Canadian Intellectual Property Office protects the name and helps with
    Charter s.58.1 (decision D16).

## 11. Artificial intelligence

- **INFERENCE.** No federal AI statute was found in force for this use (the former Bill C-27 / AIDA is not law; lawyer to
  confirm the 2026 status). The rules that apply are the general ones above: misleading claims (Competition Act, P-40.1
  s.219), privacy (P-39.1 s.12.1 for automated decisions), platform rules (Meta AI labels, Google review and content
  policies) and Clover's rule that merchants confirm messages sent on their behalf.
- Practical rules for P3 (AI content): approval before publish; AI disclosure inside the app ("Texte proposé par l'IA —
  à valider"); AI images labelled; no impersonation of customers; no fake reviews or testimonials; French by default for
  Québec.

## 12. Documents to prepare

| Document | Notes |
|---|---|
| EULA / Conditions d'utilisation (TAKATAK Clover app) | French first; licensor = TAKATAK entity; Clover not a party or liable; fees only via Clover; publishing authorization; content rules; liability; Québec or Canadian law (Clover's own agreement with us is under Ontario law) |
| Privacy policy section for the app | P-39.1 s.8 items; PIPEDA; recipients "as the merchant directs" naming Google, Meta, Pinterest; sub-processors and regions; retention and deletion on uninstall; outside-Québec notice; person in charge; effective date |
| Data processing agreement (mandate, P-39.1 s.18.3) | Merchant ↔ TAKATAK; purposes, security, no keeping after end, sub-processors, incident notice, audit |
| Sub-processor agreements | Database host, AI provider, hosting: flow-down of Clover s.18.4, Meta s.5, P-39.1 s.17–18.3 |
| PIA (évaluation des facteurs relatifs à la vie privée) | Before build; CAI guide v3.1; covers outside-Québec transfers |
| Governance policy page (P-39.1 s.3.2) | Retention, roles, complaints |
| Incident register and runbook | P-39.1 s.3.5–3.8; PIPEDA records 24 months; Meta "as soon as practicable" |
| Google third-party disclosures | "Business Profile is free"; fees; link to Google's notice; 7-business-day disconnect |
| Meta deletion instructions and callback | Platform Terms s.4; deletion callback |

## 13. Questions for the Québec lawyer (exact list)

1. **Roles.** When TAKATAK publishes a restaurant's menu, hours and posts to Google, Facebook, Instagram and Pinterest
   at the restaurant's direction, is TAKATAK a service provider (P-39.1 s.18.3) only, or also responsible as a
   publisher or advertiser (Charter s.58, P-40.1 s.219, Competition Act s.74.01)?
2. **Outside Québec.** takatak-v1's database is in Ireland (`eu-west-1`); AI providers and the platforms are mostly in
   the US. Is a PIA plus written agreements enough under s.17, or should Clover-sourced data be kept in Canada
   (`ca-central-1`)?
3. **PIA scope.** Is one PIA for the whole TAKATAK Clover app enough, or one per channel and per sub-processor?
4. **Person in charge.** Can the president remain the person in charge (default under s.3.1) while also being the
   operator, and what title and contact must be published?
5. **Consent design.** Is a per-channel, per-data-type consent screen (separate from the EULA) valid consent under s.14
   for the personal information involved (owner and staff contacts, people in photos, reviewer data)?
6. **Language.** For a Québec restaurant, must every post be in French, or is an English-only post allowed if the Page
   as a whole is French-predominant? Are social media posts "commercial advertising" (s.58) or "commercial
   documentation" (s.52)? Who carries the duty when TAKATAK writes and publishes?
7. **EULA language.** Is a French-first EULA with an English choice screen enough under s.55 when Clover's own developer
   agreement is in English only?
8. **Governing law.** Should the TAKATAK EULA choose Québec law and courts, given Clover's developer agreement chooses
   Ontario law, and merchants may be outside Québec?
9. **Liability.** Which liability limits are acceptable (art. 1437) for AI-written posts approved by the merchant, and
   for platform outages or account suspensions caused by Google or Meta?
10. **CASL.** Confirm that public posts on the merchant's own accounts are not CEMs. What is needed if TAKATAK later sends
    emails, SMS or DMs for restaurants, and for TAKATAK's own prospecting of restaurants?
11. **Consumer law.** What must TAKATAK check in posts for P-40.1 s.224 (advertised price) and s.248 (children under 13)?
    Can the EULA put that duty on the merchant?
12. **AI.** Any Québec or federal rule (in force or coming) that requires labelling AI-written text or images in
    advertising? Must TAKATAK tell consumers that a review reply was AI-drafted?
13. **Reviews.** Is the current public rating form (different wording for ratings of 4–5) a problem under the Competition
    Act's rules on reviews and under Google policy? What wording is safe?
14. **Clover data and our other products.** Do Clover Developer Terms s.4.3 and s.18 prevent using a merchant's data in
    TAKATAK's directory or QMAPS even with the merchant's separate consent?
15. **Incidents.** One incident register for all TAKATAK products, or one per product? How to coordinate the CAI notice,
    the OPC report and the platforms' notice rules (Meta "as soon as practicable")?
16. **Entity.** Which entity should sign with Clover, Google, Meta and merchants (Quadro Holdings Ltée or an operating
    company), and does it need a registered "TAKATAK" name or trademark first?

## 14. Risks (legal)

| Risk | Severity | Mitigation |
|---|---|---|
| No PIA and no written agreements for data outside Québec (s.3.3, s.17) | High | PIA before build; agreements with sub-processors; or `ca-central-1` |
| No person in charge published (s.3.1) | Medium | Decision D8; publish on takatak.ca/privacy |
| English-first contract or screens (Charter s.52.1, s.55) | Medium | French first everywhere |
| Misleading AI-written posts (P-40.1 s.219, Competition Act, Food and Drugs Act s.5) | High | Clover prices only; no invented claims; approval step; banned-words list |
| Unclear liability for posts | Medium | EULA clause reviewed by the lawyer |
| Spam rules for DMs, emails, SMS and prospecting | Medium | No DMs, emails or SMS in P1; CASL checklist for later |
