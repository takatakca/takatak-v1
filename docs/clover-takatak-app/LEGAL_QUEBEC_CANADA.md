# Legal research: Québec and Canada

> **NOT LEGAL ADVICE — À VALIDER PAR UN AVOCAT DU QUÉBEC / TO VALIDATE WITH A QUÉBEC LAWYER.**
>
> This file was written by an AI research assistant on 2026-10-23 from public law texts. It lists the rules that seem to
> apply and the questions to ask. It does not say what the law requires for TAKATAK in a binding way. Before launch, a
> member of the Barreau du Québec reviews the privacy policy, the EULA, the data processing agreement and the questions
> in section 13. Ce document n'est pas un avis juridique.

**FACT** = what the law text says (source and date). **INFERENCE** = our reading, to be confirmed by the lawyer.

## Sources read (2026-10-23)

| Text | Where | Version shown |
|---|---|---|
| Act respecting the protection of personal information in the private sector, CQLR c. P-39.1 ("Law 25" amendments) | https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1 | consolidated text read 2026-10-23 |
| Regulation respecting confidentiality incidents (O.C. 1761-2022) | https://www.legisquebec.gouv.qc.ca (regulations under P-39.1) | read 2026-10-23 |
| CAI guide "Réaliser une évaluation des facteurs relatifs à la vie privée" | Commission d'accès à l'information (cai.gouv.qc.ca) | version 3.1, April 2024 |
| Charter of the French language, CQLR c. C-11 | https://www.legisquebec.gouv.qc.ca/en/document/cs/C-11 | current to 2026-08-12 |
| Regulation respecting the language of commerce and business, CQLR c. C-11, r. 9 | https://www.legisquebec.gouv.qc.ca/en/document/cr/C-11,%20r.%209 | current to 2026-07-01 (read 2026-10-23) |
| OQLF news release "Infraction à la Charte de la langue française – Le site Web de l'entreprise Quality Belt Maintenance ltée" | https://www.quebec.ca/nouvelles/actualites/details/infraction-a-la-charte-de-la-langue-francaise-le-site-web-de-lentreprise-quality-belt-maintenance-ltee-42492 | 2022-07-22 (read 2026-10-23) |
| OQLF guide "Les médias sociaux et la Charte de la langue française : guide pratique à l'intention des entreprises" | **UNVERIFIED**: only a 2016 edition was found (BAnQ catalogue); no current oqlf.gouv.qc.ca URL found on 2026-10-23 | 2016 |
| Trademark and business-name display rules in force since 2025-06-01 (secondary) | https://educaloi.qc.ca/actualites-juridiques/droits-linguistiques-de-nouvelles-regles-pour-les-entreprises/ | read 2026-10-23; OQLF page not found |
| ICPEN guidelines for traders on online reviews (June 2016; the Competition Bureau is a member) (secondary summaries) | https://www.thelitigator.ca/?p=5620 | read 2026-10-23; original ICPEN text not loaded |
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
| Sub-processors of TAKATAK | Database host (Supabase, region `eu-west-1` for takatak-v1 today); the TAKATAK AI Gateway and the AI providers it routes to (a 13-provider roster in several countries, `src/lib/growth/ai-engine.ts`; for Clover workspaces, an allowlist of one or two named, contracted providers, ROADMAP P1.18); hosting (Coolify server, region not documented here); email or SMS provider if used |

**What data is personal (INFERENCE).** Menus, prices, hours, addresses of businesses and dish photos are mostly business
information. Personal information still appears: the owner's and staff's names, emails and phone numbers; people in
photos; reviewers' names and review texts imported from Google; comments on Facebook posts; IP addresses in logs.
**AI review replies send review text (free text that can contain names) to an AI provider**: takatak-v1 already does
this for 1–3★ Google reviews and TAKATAK ratings (ARCHITECTURE §11). So "no personal information goes to AI" is not
true, and the PIA must cover it.

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
| 17 | Before communicating personal information outside Québec (incl. entrusting it to a provider outside Québec): a PIA (sensitivity, purposes, protection measures, foreign legal framework); communicate only if protection is adequate; a written agreement | The test is "outside Québec", not "outside Canada". Applies to the `eu-west-1` (Ireland) database, the app server, the AI gateway and **each** AI provider used (each with its own country and legal framework), and Google/Meta/Pinterest servers. PIA + written agreements for each. Moving the database to `ca-central-1` (Montréal, decision D10) removes one transfer but does not replace the PIA |
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

**FACT (law, read 2026-10-23).**
- Charter s.52 (current to 2026-08-12): "Regardless of the medium used, catalogues, brochures, folders, commercial
  directories, order forms and any other documents of the same nature that are available to the public must be drawn
  up in French. No person may make such a document available to the public in a language other than French if the
  French version is not available on terms that are at least as favourable."
- Regulation C-11, r. 9, s.10 (current to 2026-07-01): such publications "may be in 2 separate versions" if the French
  version "is available under no less favourable conditions of accessibility and quality".

**FACT (OQLF).** An OQLF news release of 2022-07-22 (quebec.ca, URL in the sources table) says s.52 covers
publications of this kind "diffusées dans les sites Web et les médias sociaux".

**UNVERIFIED (OQLF guidance, no traceable source).** An earlier draft of this file quoted an OQLF sentence putting the
French duty on whoever makes the information available to the public, and cited an OQLF "aide-mémoire". Neither the
sentence nor a document by that title was found on 2026-10-23; both are withdrawn. The statutory hook for the same idea
is s.52, second paragraph ("No person may make such a document available..."). Press reports (2025–2026) describe OQLF
letters to Montréal businesses about Facebook, Instagram and TikTok posts under s.52 (secondary). The OQLF guide "Les
médias sociaux et la Charte de la langue française" was found only as a 2016 edition.

**Other dates.** s.55 (verified above) now requires the French version of a contract of adhesion to be given first; the
2023-06-01 start date comes from OQLF material and was not re-checked against the transitional provisions. Display
rules for trademarks and business names in force since 2025-06-01 (secondary: Éducaloi).

**INFERENCE.**
- The TAKATAK app UI, emails, errors, help and listing: French first, English available.
- EULA: French version shown first; English only after an express choice.
- Posts, menus and Google descriptions for a Québec restaurant: French by default, or bilingual with French at least
  equivalent (pages, menus) / markedly predominant (advertising). The generator enforces this by default; the merchant
  can add English.
- Menus synced from Clover: Clover item names are often English. For a Québec location, no item goes to Google without
  a French name (ARCHITECTURE §5 step 3, ROADMAP P1.3). Clover's own Québec rule covers app screens, not the merchant's
  published content, so Clover review will not catch this.
- TAKATAK publishes on the merchant's behalf: whether TAKATAK is a "person" who makes the document "available to the
  public" under s.52 (merchant, TAKATAK, or both) is a lawyer question (Q6).

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
- Practical rules for AI content, **from P1** (AI drafts are in the P1 flow and the P1 listing; ROADMAP P1.17):
  approval before publish; claim and word checks; prices only from Clover; AI disclosure inside the app ("Texte proposé
  par l'IA — à valider"); French by default for Québec. Merchant approval alone does not cover text TAKATAK wrote (Q1).
  Later (P3): AI images labelled; no impersonation of customers; no fake reviews or testimonials.

## 12. Documents to prepare

| Document | Notes |
|---|---|
| EULA / Conditions d'utilisation (TAKATAK Clover app) | French first; licensor: **not named in any draft until Q16 is answered** (the Clover developer account is an Individual Developer account); Clover not a party or liable; fees only via Clover; publishing authorization; content rules; liability; Québec or Canadian law (Clover's own agreement with us is under Ontario law) |
| Privacy policy section for the app | P-39.1 s.8 items; PIPEDA; recipients "as the merchant directs" naming Google, Meta, Pinterest; sub-processors and regions; retention and deletion on uninstall; outside-Québec notice; person in charge; effective date |
| Data processing agreement (mandate, P-39.1 s.18.3) | Merchant ↔ TAKATAK; purposes, security, no keeping after end, sub-processors, incident notice, audit |
| Sub-processor agreements | Database host, each allowlisted AI provider (and the AI gateway), hosting: flow-down of Clover s.18.4, Meta s.5.a, P-39.1 s.17–18.3 |
| PIA (évaluation des facteurs relatifs à la vie privée) | Before build; CAI guide v3.1; covers outside-Québec transfers |
| Governance policy page (P-39.1 s.3.2) | Retention, roles, complaints |
| Incident register and runbook | P-39.1 s.3.5–3.8; PIPEDA records 24 months; Meta "as soon as practicable" |
| Google third-party disclosures | "Business Profile is free"; fees; link to Google's notice; 7-business-day disconnect |
| Meta deletion instructions and callback | Platform Terms s.4; deletion callback |

## 13. Questions for the Québec lawyer (exact list)

1. **Roles.** When TAKATAK publishes a restaurant's menu, hours and posts to Google, Facebook, Instagram and Pinterest
   at the restaurant's direction, is TAKATAK a service provider (P-39.1 s.18.3) only, or also responsible as a
   publisher or advertiser (Charter s.58, P-40.1 s.219, Competition Act s.74.01)?
2. **Outside Québec.** takatak-v1's database is in Ireland (`eu-west-1`); the app server, the AI gateway and its
   providers (several countries, not only the US) and the platforms are outside Québec. Is a PIA plus written
   agreements enough under s.17, or should Clover-sourced data be kept in Québec (`ca-central-1`, Montréal)? Which AI
   providers can pass the s.17 test for review text?
3. **PIA scope.** Is one PIA for the whole TAKATAK Clover app enough, or one per channel and per sub-processor?
4. **Person in charge.** Can the president remain the person in charge (default under s.3.1) while also being the
   operator, and what title and contact must be published?
5. **Consent design.** Is a per-channel, per-data-type consent screen (separate from the EULA) valid consent under s.14
   for the personal information involved (owner and staff contacts, people in photos, reviewer data)? Is a separate
   consent needed for AI review replies? The app cannot tell the owner from staff: is a signer's name, title and
   statement of authority enough proof of the publishing mandate (art. 2130)? How long may consent records (signer,
   title, time, text version, scope, revocation) be kept after uninstall as proof of mandate, and how is that stated in
   the governance and privacy policies?
6. **Language.** For a Québec restaurant, must every post be in French, or is an English-only post allowed if the Page
   as a whole is French-predominant? Are social media posts "commercial advertising" (s.58) or "commercial
   documentation" (s.52)? Who carries the duty when TAKATAK writes and publishes: is TAKATAK a "person" who makes the
   document "available to the public" (s.52, second paragraph)? Same question for menus synced from Clover (s.51).
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
13. **Reviews.** The current public rating form uses a different prompt for 4–5★, offers the "show my comment on the
    business's website" consent only at 4–5★, and the public showcase lists only 4–5★ comments, with an owner hide
    switch (the average covers every rating). Is this a misleading general impression under Competition Act s.74.01(1)(a)
    and P-40.1 s.219, given ICPEN guidance not to stop consumers seeing the full range of genuine reviews, and under
    Google policy? Is the fix in ROADMAP P0.11(b) (same prompt and consent at every rating; showcase of all consented
    comments, or none; hiding only for unlawful, abusive or off-topic content, reason logged) enough?
14. **Clover data and our other products.** Do Clover Developer Terms s.4.3 and s.18 prevent using a merchant's data in
    TAKATAK's directory or QMAPS even with the merchant's separate consent?
15. **Incidents.** One incident register for all TAKATAK products, or one per product? How to coordinate the CAI notice,
    the OPC report and the platforms' notice rules (Meta "as soon as practicable")?
16. **Entity.** The Clover developer account is an **Individual Developer** account (Matthieu), and the owner keeps it.
    Can an individual Clover developer list an app whose EULA licensor, Clover service provider/processor (Developer
    Terms s.18.1) and Law 25 enterprise is Quadro Holdings Ltée (or an operating company), for example under a written
    licence or mandate between Matthieu and that company? Is that consistent with Clover s.13.1 (listing information
    true and accurate)? Which entity gets Meta Business Verification (documents in the legal entity's exact name) and the
    Google agency organization? Does it need a registered "TAKATAK" name or trademark first? What personal liability
    does Matthieu carry meanwhile?

## 14. Risks (legal)

| Risk | Severity | Mitigation |
|---|---|---|
| No PIA and no written agreements for data outside Québec (s.3.3, s.17) | High | PIA before build; agreements with sub-processors; or `ca-central-1` |
| No person in charge published (s.3.1) | Medium | Decision D8; publish on takatak.ca/privacy |
| English-first contract or screens (Charter s.52.1, s.55) | Medium | French first everywhere |
| Misleading AI-written posts (P-40.1 s.219 and s.224(c), Competition Act s.74.01 and s.52, Food and Drugs Act s.5, Charter s.58, Clover s.13.1) | High | From P1, not P3 (ROADMAP P1.17): Clover prices only; no invented claims; blocking claim and word checks; AI disclosure in the app; French by default; approval step. Or AI drafting off for Clover workspaces until those checks ship |
| Review text sent to AI providers outside Québec without a PIA or agreement (s.8, s.17; Clover s.18.4; Meta s.5.a) | High | Allowlist of one or two contracted providers for Clover workspaces; names and contacts stripped; separate consent; providers in the sub-processor list and the PIA (ROADMAP P1.18, P0.4) |
| English-only Clover menu published for a Québec location (Charter s.51, s.52) | Medium | French name required per item before sync (ROADMAP P1.3) |
| Consent proof deleted after uninstall; signer without authority (Civil Code art. 2130; Google third-party policy) | Medium | Signer name, title and authority statement; consent rows kept for a period set by the lawyer (Q5) |
| Individual developer account vs company licensor (Clover s.13.1, s.18.1; Meta verification) | Medium | Lawyer Q16 before naming a licensor in any draft |
| Unclear liability for posts | Medium | EULA clause reviewed by the lawyer |
| Spam rules for DMs, emails, SMS and prospecting | Medium | No DMs, emails or SMS in P1; CASL checklist for later |
